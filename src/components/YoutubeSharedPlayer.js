import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import PROXY_API_URL from '../config/proxy';

/*
 * ONE YouTube player for the whole feed.
 *
 * Creating a new WebView + YouTube page for every video was the cause of the
 * black screen at the start of each reel (3-5 seconds of loading). Here the
 * page loads once, and for every following video we just tell the already
 * running player to load the next video id — that takes well under a second.
 *
 * If YouTube's page does not expose that control (reported as "noapi"), we
 * fall back to loading a fresh page for each video, like before.
 */

const BEFORE = `
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
`;

const MAIN = `
(function () {
  if (window.__kxStarted) return;
  window.__kxStarted = true;

  function post(m) { try { window.ReactNativeWebView.postMessage(m); } catch (e) {} }

  function sizeVideo(video) {
    var vw = video.videoWidth, vh = video.videoHeight;
    var portrait = vw && vh && (vw / vh) < 0.8;
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
    s.setProperty('object-fit', portrait ? 'cover' : 'contain', 'important');
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

  // hide everything that is not the <video> or one of its parents
  function clean(video) {
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

  var loaded = window.__kxInitial;   // video id the page was opened with
  var reported = null;
  var errored = null;
  var loadedAt = Date.now();
  var noApiSince = 0;
  var noApiPosted = false;

  setInterval(function () {
    var video = document.querySelector('video');
    var p = document.getElementById('movie_player');
    var want = window.__kxWant;

    // error screen ("video unavailable") — check before clean() hides it
    if (loaded && errored !== loaded && Date.now() - loadedAt > 1500 &&
        document.querySelector('.ytp-error')) {
      errored = loaded;
      post('error:' + loaded);
    }

    if (!video) return;
    clean(video);
    video.loop = true;

    var hasApi = p && typeof p.loadVideoById === 'function';

    if (!hasApi) {
      if (!noApiSince) noApiSince = Date.now();
      if (!noApiPosted && Date.now() - noApiSince > 4000) {
        noApiPosted = true;
        post('noapi');
      }
      // still keep it playing and report it
      if (video.paused) { try { video.play(); } catch (e) {} }
      video.muted = window.__kxMuted === true;
      if (reported !== loaded && !video.paused && video.currentTime > 0.05) {
        reported = loaded;
        post('playing:' + loaded);
      }
      return;
    }

    // switch to the video the app wants, without reloading the page
    if (want && want !== loaded) {
      try { p.loadVideoById(want); } catch (e) {}
      loaded = want;
      loadedAt = Date.now();
      reported = null;
      errored = null;
    }

    if (window.__kxMuted === true) { try { p.mute(); } catch (e) {} }
    else { try { p.unMute(); } catch (e) {} }

    var state = -2;
    try { state = p.getPlayerState(); } catch (e) {}

    if (state === 1) {
      if (reported !== loaded) {
        reported = loaded;
        post('playing:' + loaded);
      }
    } else if (state === 0) {
      try { p.seekTo(0, true); p.playVideo(); } catch (e) {}
    } else if (state === 2 || state === 5 || state === -1) {
      try { p.playVideo(); } catch (e) {}
    }
  }, 120);
})();
true;
`;

export default function YoutubeSharedPlayer({
  videoId,
  muted,
  onPlaying,
  onError,
}) {
  const webRef = useRef(null);
  const initialId = useRef(videoId);
  const initialMuted = useRef(muted);
  const [reloadMode, setReloadMode] = useState(false);

  // tell the running player which video to show
  useEffect(() => {
    webRef.current?.injectJavaScript(`window.__kxWant = ${JSON.stringify(videoId)}; true;`);
  }, [videoId]);

  useEffect(() => {
    webRef.current?.injectJavaScript(`window.__kxMuted = ${muted ? 'true' : 'false'}; true;`);
  }, [muted]);

  // fallback: no player control available -> open a fresh page per video
  const pageId = reloadMode ? videoId : initialId.current;

  const uri =
    `https://www.youtube.com/embed/${pageId}` +
    `?autoplay=1&mute=${initialMuted.current ? 1 : 0}&controls=0&playsinline=1` +
    `&modestbranding=1&rel=0&iv_load_policy=3&fs=0&disablekb=1&enablejsapi=1`;

  const before =
    `${BEFORE}\nwindow.__kxInitial = ${JSON.stringify(pageId)};` +
    `\nwindow.__kxWant = ${JSON.stringify(videoId)};` +
    `\nwindow.__kxMuted = ${muted ? 'true' : 'false'};\ntrue;`;

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000' }}
    >
      <WebView
        key={reloadMode ? `reload-${videoId}` : 'shared'}
        ref={webRef}
        style={{ flex: 1, backgroundColor: '#000' }}
        originWhitelist={['*']}
        source={{ uri, headers: { Referer: PROXY_API_URL } }}
        injectedJavaScriptBeforeContentLoaded={before}
        injectedJavaScript={MAIN}
        onMessage={(e) => {
          const data = String(e?.nativeEvent?.data || '');
          if (data === 'noapi') {
            setReloadMode(true);
          } else if (data.startsWith('playing:')) {
            onPlaying?.(data.slice(8));
          } else if (data.startsWith('error:')) {
            onError?.(data.slice(6));
          }
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
  );
}
