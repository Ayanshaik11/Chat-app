import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const DOUBLE_TAP_MS = 280;

/**
 * UI layer of one YouTube short. The video itself is drawn by the single
 * shared player behind the list, so this item is transparent while it is the
 * active, playing one, and solid black otherwise (it slides over the video
 * while you swipe).
 *  - single tap : mute / unmute
 *  - double tap : like (heart animation only, nothing stored, no counts)
 */
export default function YoutubeShortItem({
  item,
  width,
  height,
  showVideo, // active AND already playing
  muted,
  onToggleMute,
  onShare,
}) {
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

  const shadow = {
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  };

  return (
    <View
      style={{
        width,
        height,
        backgroundColor: showVideo ? 'transparent' : '#000',
        overflow: 'hidden',
      }}
    >
      {/* tap layer: single = mute, double = like */}
      <Pressable
        onPress={handleTap}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

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
        <Text numberOfLines={2} style={{ color: '#fff', fontSize: 16, fontWeight: '700', ...shadow }}>
          {item?.title || 'YouTube Video'}
        </Text>
        <Text numberOfLines={1} style={{ color: '#ddd', fontSize: 13, marginTop: 5, ...shadow }}>
          {item?.authorName || item?.channelTitle || 'YouTube'}
        </Text>
      </View>
    </View>
  );
}
