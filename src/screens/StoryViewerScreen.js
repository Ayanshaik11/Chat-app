import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, Image, Pressable, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import { deleteStory, markStoryViewed, toggleStoryLike } from '../services/stories';
import { timeAgo } from '../utils/helpers';
import { markSeen } from '../utils/seen';
import Avatar from '../components/Avatar';
import T from '../components/T';

const IMAGE_DURATION = 5000;

// alphabetical (ascending) list of names for a set of user ids
function namesAscending(ids, friendProfiles) {
  return ids
    .map((id) => friendProfiles[id]?.name || 'Someone')
    .sort((a, b) => a.localeCompare(b));
}

export default function StoryViewerScreen({ route, navigation }) {
  const { groups, groupIndex = 0 } = route.params;
  const { me } = useAuth();
  const { friendProfiles } = useAppData();
  const { width, height } = useWindowDimensions();
  const [gi, setGi] = useState(Math.max(0, groupIndex));
  const [si, setSi] = useState(0);
  const [paused, setPaused] = useState(false);
  const [likedByMe, setLikedByMe] = useState({}); // { [storyId]: true } — optimistic local overrides
  const progress = useRef(new Animated.Value(0)).current;
  const valueRef = useRef(0);
  const animRef = useRef(null);
  const heartScale = useRef(new Animated.Value(1)).current;

  const group = groups[gi];
  const story = group?.stories[si];

  const next = useCallback(() => {
    if (si < group.stories.length - 1) setSi(si + 1);
    else if (gi < groups.length - 1) {
      setGi(gi + 1);
      setSi(0);
    } else navigation.goBack();
  }, [si, gi, group, groups.length, navigation]);

  const prev = useCallback(() => {
    if (si > 0) setSi(si - 1);
    else if (gi > 0) {
      setGi(gi - 1);
      setSi(groups[gi - 1].stories.length - 1);
    } else {
      progress.setValue(0);
      valueRef.current = 0;
    }
  }, [si, gi, groups, progress]);

  // always call the latest "next" from animation callbacks
  const nextRef = useRef(next);
  nextRef.current = next;

  useEffect(() => {
    const id = progress.addListener(({ value }) => (valueRef.current = value));
    return () => progress.removeListener(id);
  }, [progress]);

  const runImageTimer = useCallback(() => {
    animRef.current = Animated.timing(progress, {
      toValue: 1,
      duration: IMAGE_DURATION * (1 - valueRef.current),
      easing: Easing.linear,
      useNativeDriver: false,
    });
    animRef.current.start(({ finished }) => finished && nextRef.current());
  }, [progress]);

  // start timer when the story changes
  useEffect(() => {
    if (!story) return undefined;
    markSeen([story.id]);
    if (group.user.id !== me.id) markStoryViewed(story.id, me.id);
    progress.setValue(0);
    valueRef.current = 0;
    setPaused(false);
    if (story.mediaType === 'image') runImageTimer();
    return () => animRef.current && animRef.current.stop();
  }, [story?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const pause = () => {
    setPaused(true);
    animRef.current && animRef.current.stop();
  };
  const resume = () => {
    if (!paused) return;
    setPaused(false);
    if (story.mediaType === 'image') runImageTimer();
  };

  const onDelete = () => {
    pause();
    Alert.alert('Delete story?', 'This story will be removed for everyone.', [
      { text: 'Cancel', style: 'cancel', onPress: resume },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteStory(story).catch(() => {});
          navigation.goBack();
        },
      },
    ]);
  };

  if (!story) return null;
  const mine = group.user.id === me.id;
  const viewerIds = (story.viewedBy || []).filter((id) => id !== me.id);
  const likerIds = story.likedBy || [];
  const iLiked = likedByMe[story.id] ?? likerIds.includes(me.id);

  const showViewers = () => {
    pause();
    const names = namesAscending(viewerIds, friendProfiles);
    Alert.alert(`Seen by ${viewerIds.length}`, names.join('\n') || 'No one yet', [{ text: 'OK', onPress: resume }]);
  };

  const showLikers = () => {
    pause();
    const names = namesAscending(likerIds, friendProfiles);
    Alert.alert(`Liked by ${likerIds.length}`, names.join('\n') || 'No one yet', [{ text: 'OK', onPress: resume }]);
  };

  const onToggleLike = () => {
    const next = !iLiked;
    setLikedByMe((m) => ({ ...m, [story.id]: next }));
    Animated.sequence([
      Animated.timing(heartScale, { toValue: 1.4, duration: 110, useNativeDriver: true }),
      Animated.timing(heartScale, { toValue: 1, duration: 110, useNativeDriver: true }),
    ]).start();
    toggleStoryLike(story.id, me.id, iLiked);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar style="light" />
      {story.mediaType === 'video' ? (
        <Video
          key={story.id}
          source={{ uri: story.mediaURL }}
          style={{ width, height }}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay={!paused}
          onPlaybackStatusUpdate={(s) => {
            if (!s.isLoaded) return;
            if (s.durationMillis) progress.setValue(s.positionMillis / s.durationMillis);
            if (s.didJustFinish) nextRef.current();
          }}
        />
      ) : (
        <Image source={{ uri: story.mediaURL }} style={{ width, height }} resizeMode="contain" />
      )}

      {/* tap zones: left = previous, right = next, hold = pause */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row' }}>
        <Pressable style={{ flex: 1 }} onPress={prev} onLongPress={pause} onPressOut={resume} delayLongPress={200} />
        <Pressable style={{ flex: 2 }} onPress={next} onLongPress={pause} onPressOut={resume} delayLongPress={200} />
      </View>

      <SafeAreaView edges={['top']} pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
        <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: 10, paddingTop: 8 }} pointerEvents="none">
          {group.stories.map((s, i) => (
            <View key={s.id} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' }}>
              <Animated.View
                style={{
                  height: 3, backgroundColor: '#F5B700',
                  width: i < si ? '100%' : i === si ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) : '0%',
                }}
              />
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 }}>
          <Avatar uri={group.user.photoURL} name={group.user.name} size={34} />
          <View style={{ flex: 1 }}>
            <T weight="semibold" size={14} color="#fff" numberOfLines={1}>{mine ? 'Your story' : group.user.name}</T>
            <T size={11} color="rgba(255,255,255,0.8)">{timeAgo(story.createdAt)}</T>
          </View>
          {mine ? (
            <Pressable onPress={onDelete} hitSlop={12} style={{ padding: 6 }}>
              <Ionicons name="trash-outline" size={22} color="#fff" />
            </Pressable>
          ) : null}
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={{ padding: 6 }}>
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
        </View>
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        {mine ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 22 }}>
            <Pressable onPress={showViewers} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="eye-outline" size={18} color="#fff" />
              <T size={13} weight="medium" color="#fff">{viewerIds.length} {viewerIds.length === 1 ? 'view' : 'views'}</T>
            </Pressable>
            <Pressable onPress={showLikers} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="heart" size={18} color="#F5B700" />
              <T size={13} weight="medium" color="#fff">{likerIds.length} {likerIds.length === 1 ? 'like' : 'likes'}</T>
            </Pressable>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingVertical: 14 }}>
            <Pressable onPress={onToggleLike} hitSlop={12}>
              <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                <Ionicons name={iLiked ? 'heart' : 'heart-outline'} size={30} color={iLiked ? '#F5B700' : '#fff'} />
              </Animated.View>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}
