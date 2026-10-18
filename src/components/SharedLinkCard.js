import React, { useState } from 'react';
import { Image, Linking, Modal, Pressable, StatusBar, Text, View, useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import PROXY_API_URL from '../config/proxy';

const YOUTUBE_RE =
  /(https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:shorts\/|watch\?v=)|youtu\.be\/)([A-Za-z0-9_-]{11})[^\s]*)/i;
const INSTAGRAM_RE =
  /(https?:\/\/(?:www\.)?instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(?:reels?|p|tv)\/([A-Za-z0-9_-]+)[^\s]*)/i;
const VIDEO_FILE_RE = /(https?:\/\/[^\s]+?(?:\.(?:mp4|mov|m4v|webm)|\/video\/upload\/[^\s]+)(?:\?[^\s]*)?)/i;

/** Returns { kind, url, id?, caption } when the message holds a playable link, else null. */
export function parseSharedLink(text) {
  const value = String(text || '');

  const yt = value.match(YOUTUBE_RE);
  if (yt) {
    return {
      kind: 'youtube',
      url: yt[1],
      id: yt[2],
      isShort: /\/shorts\//i.test(yt[1]),
      caption: value.replace(yt[1], '').replace(/^\s*🎬\s*/, '').trim(),
    };
  }

  const ig = value.match(INSTAGRAM_RE);
  if (ig) {
    return {
      kind: 'instagram',
      url: ig[1],
      id: ig[2],
      caption: value.replace(ig[1], '').replace(/^\s*🎬\s*/, '').trim(),
    };
  }

  const file = value.match(VIDEO_FILE_RE);
  if (file) {
    return {
      kind: 'file',
      url: file[1],
      caption: value.replace(file[1], '').replace(/^\s*🎬\s*/, '').trim(),
    };
  }

  return null;
}

const CARD_W = 232;

/**
 * WhatsApp-style link preview inside a chat bubble:
 * thumbnail + play button + caption. Tap to play right inside the app.
 */
export default function SharedLinkCard({ link, textColor = '#fff' }) {
  const [open, setOpen] = useState(false);
  const { width, height } = useWindowDimensions();

  const thumb =
    link.kind === 'youtube' ? `https://i.ytimg.com/vi/${link.id}/hqdefault.jpg` : null;

  return (
    <View style={{ width: CARD_W }}>
      <Pressable onPress={() => setOpen(true)}>
        <View
          style={{
            width: CARD_W,
            height: link.kind === 'instagram' ? 300 : link.kind === 'youtube' && link.isShort ? 300 : 140,
            borderRadius: 12,
            overflow: 'hidden',
            backgroundColor: '#000',
          }}
        >
          {link.kind === 'instagram' ? (
            <LinearGradient
              colors={['#515BD4', '#8134AF', '#DD2A7B', '#F58529']}
              start={{ x: 0, y: 1 }}
              end={{ x: 1, y: 0 }}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 26 }}
            >
              <Ionicons name="logo-instagram" size={64} color="rgba(255,255,255,0.9)" />
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', marginTop: 8 }}>Instagram Reel</Text>
            </LinearGradient>
          ) : thumb ? (
            <Image source={{ uri: thumb }} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#161616' }}>
              <Ionicons name="videocam" size={34} color="#555" />
            </View>
          )}

          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
            <View
              style={{
                width: 54,
                height: 54,
                borderRadius: 27,
                backgroundColor: 'rgba(0,0,0,0.55)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="play" size={28} color="#fff" style={{ marginLeft: 3 }} />
            </View>
          </View>

          {(link.kind === 'youtube' || link.kind === 'instagram') && (
            <View
              style={{
                position: 'absolute',
                left: 8,
                bottom: 8,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgba(0,0,0,0.6)',
                borderRadius: 6,
                paddingHorizontal: 6,
                paddingVertical: 3,
              }}
            >
              <Ionicons
                name={link.kind === 'instagram' ? 'logo-instagram' : 'logo-youtube'}
                size={14}
                color={link.kind === 'instagram' ? '#E1306C' : '#FF0000'}
              />
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600', marginLeft: 4 }}>
                {link.kind === 'instagram' ? 'Reels' : link.isShort ? 'Shorts' : 'YouTube'}
              </Text>
            </View>
          )}
        </View>
      </Pressable>

      {!!link.caption && (
        <Text style={{ color: textColor, fontSize: 14, marginTop: 8 }} numberOfLines={3}>
          {link.caption}
        </Text>
      )}

      {/* full-screen player */}
      <Modal visible={open} animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <StatusBar hidden={open} />

          {open && link.kind === 'youtube' && (
            <WebView
              style={{ flex: 1, backgroundColor: '#000' }}
              originWhitelist={['*']}
              source={{
                uri: `https://www.youtube.com/embed/${link.id}?autoplay=1&playsinline=1&rel=0&modestbranding=1`,
                headers: { Referer: PROXY_API_URL },
              }}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled
              domStorageEnabled
              allowsFullscreenVideo
            />
          )}

          {open && link.kind === 'instagram' && (
            <WebView
              style={{ flex: 1, backgroundColor: '#000', marginTop: 90 }}
              originWhitelist={['*']}
              source={{ uri: `https://www.instagram.com/reel/${link.id}/embed/` }}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled
              domStorageEnabled
              allowsFullscreenVideo
              setSupportMultipleWindows={false}
            />
          )}

          {open && link.kind === 'file' && (
            <Video
              source={{ uri: link.url }}
              style={{ width, height }}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
              useNativeControls
              isLooping
            />
          )}

          <Pressable
            onPress={() => setOpen(false)}
            hitSlop={12}
            style={{
              position: 'absolute',
              top: 44,
              left: 16,
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(0,0,0,0.6)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>

          {(link.kind === 'youtube' || link.kind === 'instagram') && (
            <Pressable
              onPress={() => Linking.openURL(link.url).catch(() => {})}
              style={{ position: 'absolute', top: 50, right: 16 }}
            >
              <Text style={{ color: '#ddd', fontSize: 13 }}>
                {link.kind === 'instagram' ? 'Open in Instagram' : 'Open in YouTube'}
              </Text>
            </Pressable>
          )}
        </View>
      </Modal>
    </View>
  );
}
