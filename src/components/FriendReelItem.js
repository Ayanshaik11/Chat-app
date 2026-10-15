import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import Avatar from './Avatar';
import EditedVideo from './EditedVideo';
import { useMusic } from '../utils/useMusic';

const DOUBLE_TAP_MS = 280;
const fill = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };
const shadow = { textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 };

const fmt = (n) => {
  const v = Number(n) || 0;
  return v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}K` : String(v);
};

const RailButton = ({ icon, color = '#fff', label, onPress }) => (
  <Pressable onPress={onPress} hitSlop={8} style={{ alignItems: 'center', marginTop: 20 }}>
    <Ionicons name={icon} size={32} color={color} style={shadow} />
    {label != null && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600', marginTop: 2, ...shadow }}>{label}</Text>}
  </Pressable>
);

/**
 * One full-screen friend reel.
 *  - single tap : mute / unmute      - double tap : like (heart animation)
 *  - right rail : like, comments, share, delete (own reels only)
 * Reels made with the editor (item.edit) play with their zoom, effect and text applied.
 */
export default function FriendReelItem({ item, width, height, isActive, muted, meId, author, commentCount = 0, onToggleMute, onLike, onComments, onShare, onDelete }) {
  const uri = item?.videoURL || item?.videoUrl || item?.url || item?.video || item?.mediaUrl;
  const likes = Array.isArray(item?.likes) ? item.likes : [];
  const liked = !!meId && likes.includes(meId);
  const isMine = !!meId && item?.authorId === meId;

  const lastTap = useRef(0);
  const tapTimer = useRef(null);
  const muteTimer = useRef(null);
  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;
  const [muteHint, setMuteHint] = useState(false);
  useMusic(item?.music, isActive, muted); // the reel's song (replaces the video's own sound)

  useEffect(() => () => { clearTimeout(tapTimer.current); clearTimeout(muteTimer.current); }, []);

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
    if (now - lastTap.current < DOUBLE_TAP_MS) { // double tap = like (never un-likes)
      clearTimeout(tapTimer.current);
      lastTap.current = 0;
      burstHeart();
      if (!liked) onLike?.(item, true);
      return;
    }
    lastTap.current = now;
    clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => { // single tap = mute / unmute
      onToggleMute?.();
      setMuteHint(true);
      clearTimeout(muteTimer.current);
      muteTimer.current = setTimeout(() => setMuteHint(false), 800);
    }, DOUBLE_TAP_MS);
  };

  const playing = { shouldPlay: isActive, isLooping: true, isMuted: muted || !!item?.music, useNativeControls: false };
  const centered = (size) => ({ position: 'absolute', top: height / 2 - size / 2, left: width / 2 - size / 2, width: size, height: size, alignItems: 'center', justifyContent: 'center' });

  return (
    <View style={{ width, height, backgroundColor: '#000' }}>
      {uri ? (
        item.edit
          ? <View style={fill}><EditedVideo uri={uri} edit={item.edit} width={width} height={height} {...playing} /></View>
          : <Video source={{ uri }} style={fill} resizeMode={ResizeMode.COVER} {...playing} />
      ) : null}

      <Pressable onPress={handleTap} style={fill} />

      <Animated.View pointerEvents="none" style={[centered(120), { opacity: heartOpacity, transform: [{ scale: heartScale }] }]}>
        <Ionicons name="heart" size={110} color="#E11D2A" />
      </Animated.View>

      {muteHint && (
        <View pointerEvents="none" style={[centered(64), { borderRadius: 32, backgroundColor: 'rgba(0,0,0,0.55)' }]}>
          <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={32} color="#fff" />
        </View>
      )}

      <View style={{ position: 'absolute', right: 14, bottom: 60, alignItems: 'center' }}>
        <RailButton icon={liked ? 'heart' : 'heart-outline'} color={liked ? '#E11D2A' : '#fff'} label={fmt(likes.length)} onPress={() => onLike?.(item, false)} />
        <RailButton icon="chatbubble-outline" label={fmt(commentCount)} onPress={() => onComments?.(item)} />
        <RailButton icon="paper-plane-outline" label="Share" onPress={() => onShare?.(item)} />
        {isMine && <RailButton icon="trash-outline" label="Delete" onPress={() => onDelete?.(item)} />}
      </View>

      <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 90, bottom: 40 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Avatar uri={author?.photoURL} name={author?.name} size={36} />
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15, marginLeft: 10, ...shadow }} numberOfLines={1}>{author?.name || 'User'}</Text>
        </View>
        {!!item?.music && <Text style={{ color: '#fff', fontSize: 12, marginTop: 6, ...shadow }} numberOfLines={1}>♪ {item.music.name} · {item.music.artist}</Text>}
        {!!item?.caption && <Text style={{ color: '#fff', fontSize: 14, marginTop: 8, ...shadow }} numberOfLines={3}>{item.caption}</Text>}
      </View>
    </View>
  );
}
