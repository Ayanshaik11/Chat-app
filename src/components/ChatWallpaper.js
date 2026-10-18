import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { DEFAULT_THEME_ID } from '../utils/chatTheme';
import { useWallpaperUrl } from '../hooks/useWallpaperUrls';

/**
 * The chat wallpaper layer.
 *
 * Renders *behind* the header, message list and composer. It is fully
 * non-interactive (`pointerEvents="none"`) so taps, long-presses, swipe-to-reply
 * and scrolling all pass straight through to the messages on top of it.
 *
 * If the remote bitmap fails to load we keep a themed gradient instead, so the
 * chat never looks broken and the overlay still protects text contrast.
 */
export default function ChatWallpaper({ theme }) {
  const [failed, setFailed] = useState(false);
  // Only the authenticated API's signed URL is used for wallpaper images.
  const signedUrl = useWallpaperUrl(theme?.id);
  const uri = signedUrl || null;
  // Themes other than the default are expected to have a wallpaper, so they keep
  // the gradient while the signed URL is loading (or if it fails).
  const wantsWallpaper = !!theme?.id && theme.id !== DEFAULT_THEME_ID;

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  if (!theme) return null;

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: theme.backgroundColor }]}
    >
      {uri && !failed ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          fadeDuration={0}
          onError={() => setFailed(true)}
        />
      ) : wantsWallpaper ? (
        <LinearGradient
          colors={[theme.backgroundColor, theme.incomingBubbleColor || theme.backgroundColor]}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      {/* readability overlay — keeps bubbles and text legible over any photo */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: theme.backgroundOverlayColor || 'rgba(0,0,0,0.4)' },
        ]}
      />
    </View>
  );
}
