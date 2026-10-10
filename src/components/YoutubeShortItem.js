import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import PROXY_API_URL from '../config/proxy';

const DOUBLE_TAP_MS = 280;

// Runs inside the YouTube embed page:
//  - hides every YouTube overlay (play/pause icon, logo, title, gradients)
//  - loops the video natively (no reload / no black flash)
//  - reports when the video is really playing, or when it can't be played
const INJECTED = `
(function () {
  var css = document.createElement('style');
  css.textContent = [
    '.ytp-chrome-top','.ytp-chrome-bottom','.ytp-gradient-top','.ytp-gradient-bottom',
    '.ytp-pause-overlay','.ytp-large-play-button','.ytp-watermark','.ytp-youtube-button',
    '.ytp-impression-link','.ytp-ce-element','.ytp-cards-teaser','.ytp-endscreen-content',
    '.ytp-show-cards-title','.ytp-spinner','.ytp-contextmenu','.ytp-popup',
    '.ytp-paid-content-overlay','.ytp-videowall-still','.ytp-iv-video-content','.annotation'
  ].join(',') + '{display:none !important;opacity:0 !important;visibility:hidden !important}' +
  'html,body{background:#000 !important}';
  (document.head || document.documentElement).appendChild(css);

  // Hide EVERYTHING that is not the <video> (or one of its parents):
  // YouTube's own like / share / channel / title / Shorts logo UI.
  function clean() {
    var video = document.querySelector('video');
    if (!video) return;
    var node = video;
    while (node && node !== document.documentElement) {
      var parent = node.parentElement;
      if (!parent) break;
      Array.prototype.forEach.call(parent.children, function (child) {
        if (child !== node && child.tagName !== 'SCRIPT' && child.tagName !== 'STYLE') {
          child.style.setProperty('display', 'none', 'important');
        }
      });
      node = parent;
    }
    sizeVideo(video);
  }

  // Make the video fill the screen. Portrait videos are cropped to cover it;
  // wide ones stay fully visible in the middle.
  function sizeVideo(video) {
    var vw = video.videoWidth, vh = video.videoHeight;
    var portrait = vw && vh && (vw / vh) < 0.8;
    var fit = portrait ? 'cover' : 'contain';
    var s = video.style;
    s.setProperty('position', 'fixed', 'important');
    s.setProperty('top', '0', 'important');
    s.setProperty('left', '0', 'important');
    s.setProperty('width', '100vw', 'important');
    s.setProperty('height', '100vh', 'important');
    s.setProperty('max-width', 'none', 'important');
    s.setProperty('max-height', 'none', 'important');
    s.setProperty('margin', '0', 'important');
    s.setProperty('transform', 'none', 'important');
    s.setProperty('object-fit', fit, 'important');
    var node = video.parentElement;
    while (node && node !== document.body && node !== document.documentElement) {
      node.style.setProperty('transform', 'none', 'important');
      node.style.setProperty('width', '100%', 'important');
      node.style.setProperty('height', '100%', 'important');
      node.style.setProperty('top', '0', 'important');
      node.style.setProperty('left', '0', 'important');
      node = node.parentElement;
    }
  }

  var reported = false;
  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    clean();
    var v = document.querySelector('video');
    if (v) {
      v.loop = true;
      if (window.__kxActive === true) {
        if (v.paused) { try { v.play(); } catch (e) {} }
        if (!reported && !v.paused && v.currentTime > 0.05) {
          reported = true;
          window.ReactNativeWebView.postMessage('playing');
        }
      } else if (!v.paused) {
        // preloaded for the next swipe: stay silent until it becomes active
        try { v.pause(); } catch (e) {}
      }
    }
    if (document.querySelector('.ytp-error')) {
      window.ReactNativeWebView.postMessage('error:unavailable');
      clearInterval(timer);
    }
    if (tries > 1200) clearInterval(timer);
  }, 150);
})();
true;
`;

// Runs BEFORE the page draws, so YouTube's overlays never flash on screen.
// (textContent, not innerHTML: YouTube blocks innerHTML with Trusted Types.)
const INJECTED_BEFORE = `
(function () {
  try {
    var css = document.createElement('style');
    css.textContent = [
      '.ytp-chrome-top','.ytp-chrome-bottom','.ytp-gradient-top','.ytp-gradient-bottom',
      '.ytp-pause-overlay','.ytp-large-play-button','.ytp-watermark','.ytp-youtube-button',
      '.ytp-impression-link','.ytp-ce-element','.ytp-cards-teaser','.ytp-endscreen-content',
      '.ytp-spinner','.ytp-paid-content-overlay','.ytp-videowall-still','.annotation'
    ].join(',') + '{display:none !important;opacity:0 !important;visibility:hidden !important}' +
    'html,body{background:#000 !important}';
    (document.head || document.documentElement).appendChild(css);
  } catch (e) {}
})();
true;
`;

/**
 * One full-screen YouTube short.
 *  - single tap  : mute / unmute  (done through JS, the player never reloads)
 *  - double tap  : like — heart animation only, nothing stored, no counts
 */
export default function YoutubeShortItem({
  item,
  width,
  height,
  isActive,
  shouldLoad = true,
  muted,
  onToggleMute,
  onShare,
  onUnavailable,
}) {
  const webRef = useRef(null);
  const initialActive = useRef(isActive); // autoplay only if it is on screen at mount
  const initialMuted = useRef(muted); // the URL must never change, or the player reloads
  const [ready, setReady] = useState(false);
  const [liked, setLiked] = useState(false); // in memory only
  const [muteHint, setMuteHint] = useState(false);

  const lastTap = useRef(0);
  const tapTimer = useRef(null);
  const muteTimer = useRef(null);

  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;

  useEffect(
    () => () => {
      clearTimeout(tapTimer.current);
      clearTimeout(muteTimer.current);
    },
    []
  );

  // New player each time this video becomes the active one:
  //  - start from "loading" (thumbnail visible)
  //  - never leave the thumbnail stuck: after 2.5s show the player anyway
  useEffect(() => {
    if (!isActive) {
      setReady(false);
      return undefined;
    }
    const timer = setTimeout(() => setReady(true), 2500);
    return () => clearTimeout(timer);
  }, [isActive]);

  // start / stop playback when the video becomes (in)active — no reload needed
  useEffect(() => {
    webRef.current?.injectJavaScript(`
      window.__kxActive = ${isActive ? 'true' : 'false'};
      (function(){
        var v = document.querySelector('video');
        if (v) { ${isActive ? 'try { v.play(); } catch (e) {}' : 'try { v.pause(); } catch (e) {}'} }
      })(); true;
    `);
  }, [isActive]);

  // mute / unmute without reloading
  useEffect(() => {
    webRef.current?.injectJavaScript(`
      (function(){
        var v=document.querySelector('video');
        if(v){ v.muted=${muted ? 'true' : 'false'}; if(!${muted ? 'true' : 'false'}){ v.volume=1; } }
      })(); true;
    `);
  }, [muted, ready]);

  const burstHeart = () => {
    heartScale.setValue(0.4);
    heartOpacity.setValue(1);
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.1, useNativeDriver: true, friction: 5 }),
      Animated.timing(heartOpacity, { toValue: 0, duration: 350, delay: 250, useNativeDriver: true }),
    ]).start();
  };

  const handleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      clearTimeout(tapTimer.current);
      lastTap.current = 0;
      burstHeart();
      setLiked(true);
      return;
    }
    lastTap.current = now;
    clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => {
      onToggleMute?.();
      setMuteHint(true);
      clearTimeout(muteTimer.current);
      muteTimer.current = setTimeout(() => setMuteHint(false), 800);
    }, DOUBLE_TAP_MS);
  };

  const uri =
    `https://www.youtube.com/embed/${item.videoId}` +
    `?autoplay=${initialActive.current ? 1 : 0}&mute=${initialMuted.current ? 1 : 0}&controls=0&playsinline=1` +
    `&modestbranding=1&rel=0&iv_load_policy=3&fs=0&disablekb=1`;

  return (
    <View style={{ width, height, backgroundColor: '#000', overflow: 'hidden' }}>
      {shouldLoad && (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, width, height }}>
          <WebView
            ref={webRef}
            style={{ width, height, backgroundColor: 'transparent', opacity: ready ? 1 : 0.01 }}
            originWhitelist={['*']}
            source={{ uri, headers: { Referer: PROXY_API_URL } }}
            injectedJavaScriptBeforeContentLoaded={`${INJECTED_BEFORE} window.__kxActive = ${initialActive.current ? 'true' : 'false'}; true;`}
            injectedJavaScript={INJECTED}
            onMessage={(e) => {
              const data = String(e?.nativeEvent?.data || '');
              if (data === 'playing') setReady(true);
              if (data.startsWith('error')) onUnavailable?.(item);
            }}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            domStorageEnabled
            scrollEnabled={false}
            bounces={false}
            androidLayerType="hardware"
            setSupportMultipleWindows={false}
          />
        </View>
      )}

      {/* tap layer: single = mute, double = like */}
      <Pressable
        onPress={handleTap}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* heart burst */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: height / 2 - 60,
          left: width / 2 - 60,
          width: 120,
          height: 120,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: heartOpacity,
          transform: [{ scale: heartScale }],
        }}
      >
        <Ionicons name="heart" size={110} color="#E11D2A" />
      </Animated.View>

      {muteHint && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: height / 2 - 32,
            left: width / 2 - 32,
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: 'rgba(0,0,0,0.55)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={32} color="#fff" />
        </View>
      )}

      {/* right rail: like (no count) + share */}
      <View style={{ position: 'absolute', right: 14, bottom: 60, alignItems: 'center' }}>
        <Pressable
          onPress={() => {
            if (!liked) burstHeart();
            setLiked((v) => !v);
          }}
          hitSlop={8}
          style={{ marginTop: 20 }}
        >
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={32}
            color={liked ? '#E11D2A' : '#fff'}
          />
        </Pressable>
        <Pressable onPress={() => onShare?.(item)} hitSlop={8} style={{ marginTop: 22 }}>
          <Ionicons name="paper-plane-outline" size={30} color="#fff" />
        </Pressable>
      </View>

      {/* title + channel */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 80, bottom: 40 }}>
        <Text
          numberOfLines={2}
          style={{
            color: '#fff',
            fontSize: 16,
            fontWeight: '700',
            textShadowColor: 'rgba(0,0,0,0.8)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 4,
          }}
        >
          {item?.title || 'YouTube Video'}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            color: '#ddd',
            fontSize: 13,
            marginTop: 5,
            textShadowColor: 'rgba(0,0,0,0.8)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 4,
          }}
        >
          {item?.authorName || item?.channelTitle || 'YouTube'}
        </Text>
      </View>
    </View>
  );
}
