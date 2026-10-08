import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, Text, View } from 'react-native';
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
  css.innerHTML = [
    '.ytp-chrome-top','.ytp-chrome-bottom','.ytp-gradient-top','.ytp-gradient-bottom',
    '.ytp-pause-overlay','.ytp-large-play-button','.ytp-watermark','.ytp-youtube-button',
    '.ytp-impression-link','.ytp-ce-element','.ytp-cards-teaser','.ytp-endscreen-content',
    '.ytp-show-cards-title','.ytp-spinner','.ytp-contextmenu','.ytp-popup',
    '.ytp-paid-content-overlay','.ytp-videowall-still','.ytp-iv-video-content','.annotation'
  ].join(',') + '{display:none !important;opacity:0 !important;visibility:hidden !important}' +
  'html,body{background:#000 !important}';
  document.head.appendChild(css);

  var reported = false;
  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    var v = document.querySelector('video');
    if (v) {
      v.loop = true;
      if (v.paused) { try { v.play(); } catch (e) {} }
      if (!reported && !v.paused && v.currentTime > 0.05) {
        reported = true;
        window.ReactNativeWebView.postMessage('playing');
      }
    }
    if (document.querySelector('.ytp-error')) {
      window.ReactNativeWebView.postMessage('error:unavailable');
      clearInterval(timer);
    }
    if (tries > 120) clearInterval(timer);
  }, 250);
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
  muted,
  onToggleMute,
  onShare,
  onUnavailable,
}) {
  const webRef = useRef(null);
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
  //  - never leave the thumbnail stuck: after 3.5s show the player anyway
  useEffect(() => {
    if (!isActive) {
      setReady(false);
      return undefined;
    }
    const timer = setTimeout(() => setReady(true), 3500);
    return () => clearTimeout(timer);
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
    `?autoplay=1&mute=${initialMuted.current ? 1 : 0}&controls=0&playsinline=1` +
    `&modestbranding=1&rel=0&iv_load_policy=3&fs=0&disablekb=1`;

  return (
    <View style={{ width, height, backgroundColor: '#000', overflow: 'hidden' }}>
      {/* thumbnail shows while the player loads, so there is no black flash */}
      {!!item.thumbnail && !ready && (
        <Image
          source={{ uri: item.thumbnail }}
          resizeMode="contain"
          style={{ position: 'absolute', top: 0, left: 0, width, height }}
        />
      )}

      {isActive && (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, width, height }}>
          <WebView
            ref={webRef}
            style={{ width, height, backgroundColor: 'transparent', opacity: ready ? 1 : 0.01 }}
            originWhitelist={['*']}
            source={{ uri, headers: { Referer: PROXY_API_URL } }}
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
