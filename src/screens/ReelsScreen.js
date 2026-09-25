import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, FlatList, Pressable, RefreshControl, View, useWindowDimensions } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import { useSettings, useTheme } from '../context/SettingsContext';
import { deleteReel, fetchReels, toggleReelLike } from '../services/reels';
import Avatar from '../components/Avatar';
import EmptyState from '../components/EmptyState';
import T from '../components/T';

function ReelItem({ reel, author, meId, active, muted, onToggleMute, onLike, onDelete, onOpenAuthor, itemHeight }) {
  const scale = useRef(new Animated.Value(1)).current;
  const likes = reel.likes || [];
  const liked = likes.includes(meId);

  const like = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.4, duration: 110, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 110, useNativeDriver: true }),
    ]).start();
    onLike(reel);
  };

  return (
    <Pressable onPress={onToggleMute} style={{ height: itemHeight, width: '100%', backgroundColor: '#000' }}>
      <Video
        source={{ uri: reel.videoURL }}
        style={{ width: '100%', height: '100%' }}
        resizeMode={ResizeMode.COVER}
        isLooping
        shouldPlay={active}
        isMuted={muted}
      />

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: 28 }}>
        <Pressable onPress={() => onOpenAuthor(reel.authorId)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Avatar uri={author?.photoURL} name={author?.name} size={34} />
          <T weight="semibold" color="#fff" size={14}>{author?.username || author?.name || 'User'}</T>
        </Pressable>
        {reel.caption ? <T color="#fff" size={13} style={{ maxWidth: '80%' }}>{reel.caption}</T> : null}
      </View>

      <View style={{ position: 'absolute', right: 12, bottom: 90, alignItems: 'center', gap: 22 }}>
        <Pressable onPress={like} hitSlop={10} style={{ alignItems: 'center' }}>
          <Animated.View style={{ transform: [{ scale }] }}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={32} color={liked ? '#F43F5E' : '#fff'} />
          </Animated.View>
          <T size={12} color="#fff" style={{ marginTop: 2 }}>{likes.length}</T>
        </Pressable>
        <Pressable onPress={onToggleMute} hitSlop={10}>
          <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={26} color="#fff" />
        </Pressable>
        {reel.authorId === meId ? (
          <Pressable onPress={() => onDelete(reel)} hitSlop={10}>
            <Ionicons name="trash-outline" size={24} color="#fff" />
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function ReelsScreen({ navigation }) {
  const { me } = useAuth();
  const { friendIds, friendProfiles } = useAppData();
  const { colors } = useTheme();
  const { vibrate } = useSettings();
  const { height } = useWindowDimensions();
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);

  const audienceKey = [me.id, ...friendIds].sort().join(',');
  const people = { [me.id]: me, ...friendProfiles };

  const load = useCallback(async () => {
    try {
      setReels(await fetchReels(audienceKey.split(',')));
    } catch (e) {
      console.warn('reels load failed', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [audienceKey]);

  useFocusEffect(
    useCallback(() => {
      load();
      return () => setActiveIndex(-1); // pause all videos when the tab loses focus
    }, [load])
  );

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length) setActiveIndex(viewableItems[0].index ?? 0);
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 70 }).current;

  const onLike = (reel) => {
    const liked = (reel.likes || []).includes(me.id);
    setReels((rs) =>
      rs.map((r) =>
        r.id === reel.id ? { ...r, likes: liked ? r.likes.filter((x) => x !== me.id) : [...(r.likes || []), me.id] } : r
      )
    );
    if (!liked) vibrate(15);
    toggleReelLike(reel.id, me.id, liked).catch(() => load());
  };

  const onDelete = (reel) =>
    Alert.alert('Delete reel?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          setReels((rs) => rs.filter((r) => r.id !== reel.id));
          await deleteReel(reel).catch(() => {});
        },
      },
    ]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!reels.length) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <EmptyState
          icon="videocam-outline" title="No reels yet"
          text="Share a short video, or add friends to see theirs here."
          actionLabel="Create a reel" onAction={() => navigation.navigate('Create', { mode: 'reel' })}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <FlatList
        data={reels}
        keyExtractor={(r) => r.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={height}
        decelerationRate="fast"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#fff" />}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
        renderItem={({ item, index }) => (
          <ReelItem
            reel={item} author={people[item.authorId]} meId={me.id} itemHeight={height}
            active={index === activeIndex} muted={muted} onToggleMute={() => setMuted((m) => !m)}
            onLike={onLike} onDelete={onDelete}
            onOpenAuthor={(uid) => (uid === me.id ? navigation.navigate('Profile') : navigation.navigate('UserProfile', { userId: uid }))}
          />
        )}
      />
      <Pressable
        onPress={() => navigation.navigate('Create', { mode: 'reel' })}
        style={{ position: 'absolute', top: 50, right: 16 }}
      >
        <Ionicons name="add-circle" size={32} color="#fff" />
      </Pressable>
    </View>
  );
}
