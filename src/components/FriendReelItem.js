import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import Avatar from './Avatar';

const DOUBLE_TAP_MS = 280;

const fmt = (n) => {
  const v = Number(n) || 0;
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return String(v);
};

/**
 * One full-screen friend reel.
 *  - single tap  : mute / unmute
 *  - double tap  : like (with heart animation)
 *  - right rail  : like, comments, share, delete (own reels only)
 */
export default function FriendReelItem({
  item,
  width,
  height,
  isActive,
  muted,
  meId,
  author,
  commentCount = 0,
  onToggleMute,
  onLike,
  onComments,
  onShare,
  onDelete,
}) {
  const uri = item?.videoURL || item?.videoUrl || item?.url || item?.video || item?.mediaUrl;
  const likes = Array.isArray(item?.likes) ? item.likes : [];
  const liked = !!meId && likes.includes(meId);
  const isMine = !!meId && item?.authorId === meId;

  const lastTap = useRef(0);
  const tapTimer = useRef(null);

  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;
  const [muteHint, setMuteHint] = useState(false);
  const muteTimer = useRef(null);

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
      // double tap -> like (never un-likes)
      clearTimeout(tapTimer.current);
      lastTap.current = 0;
      burstHeart();
      if (!liked) onLike?.(item, true);
      return;
    }
    lastTap.current = now;
    clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => {
      // single tap -> mute / unmute
      onToggleMute?.();
      setMuteHint(true);
      clearTimeout(muteTimer.current);
      muteTimer.current = setTimeout(() => setMuteHint(false), 800);
    }, DOUBLE_TAP_MS);
  };

  const RailButton = ({ icon, color = '#fff', label, onPress }) => (
    <Pressable onPress={onPress} hitSlop={8} style={{ alignItems: 'center', marginTop: 20 }}>
      <Ionicons name={icon} size={32} color={color} style={shadow} />
      {label !== undefined && label !== null && (
        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600', marginTop: 2, ...shadow }}>{label}</Text>
      )}
    </Pressable>
  );

  return (
    <View style={{ width, height, backgroundColor: '#000' }}>
      {uri ? (
        <Video
          source={{ uri }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          resizeMode={ResizeMode.COVER}
          shouldPlay={isActive}
          isLooping
          isMuted={muted}
          useNativeControls={false}
        />
      ) : null}

      {/* tap layer: single = mute, double = like */}
      <Pressable onPress={handleTap} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />

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

      {/* mute hint */}
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

      {/* right action rail */}
      <View style={{ position: 'absolute', right: 14, bottom: 60, alignItems: 'center' }}>
        <RailButton
          icon={liked ? 'heart' : 'heart-outline'}
          color={liked ? '#E11D2A' : '#fff'}
          label={fmt(likes.length)}
          onPress={() => onLike?.(item, false)}
        />
        <RailButton icon="chatbubble-outline" label={fmt(commentCount)} onPress={() => onComments?.(item)} />
        <RailButton icon="paper-plane-outline" label="Share" onPress={() => onShare?.(item)} />
        {isMine && <RailButton icon="trash-outline" label="Delete" onPress={() => onDelete?.(item)} />}
      </View>

      {/* author + caption */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 90, bottom: 40 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Avatar uri={author?.photoURL} name={author?.name} size={36} />
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15, marginLeft: 10, ...shadow }} numberOfLines={1}>
            {author?.name || 'User'}
          </Text>
        </View>
        {!!item?.caption && (
          <Text style={{ color: '#fff', fontSize: 14, marginTop: 8, ...shadow }} numberOfLines={3}>
            {item.caption}
          </Text>
        )}
      </View>
    </View>
  );
}

const shadow = {
  textShadowColor: 'rgba(0,0,0,0.8)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 4,
};
