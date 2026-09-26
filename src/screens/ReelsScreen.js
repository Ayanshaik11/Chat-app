import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, FlatList, Image, KeyboardAvoidingView, Linking, Modal, Platform, Pressable,
  RefreshControl, TextInput, View, useWindowDimensions,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import YoutubePlayer from 'react-native-youtube-iframe';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import { useSettings, useTheme } from '../context/SettingsContext';
import { deleteReel, fetchReels, toggleReelLike } from '../services/reels';
import { fetchShorts } from '../services/youtube';
import { addReelComment, deleteReelComment, getReelCommentCount, subscribeReelComments } from '../services/reelComments';
import { timeAgo } from '../utils/helpers';
import Avatar from '../components/Avatar';
import EmptyState from '../components/EmptyState';
import T from '../components/T';

function ReelItem({ reel, author, meId, active, muted, onToggleMute, onLike, onDelete, onOpenAuthor, onOpenComments, itemHeight }) {
  const { width } = useWindowDimensions();
  const scale = useRef(new Animated.Value(1)).current;
  const likes = reel.likes || [];
  const liked = likes.includes(meId);
  const canLike = !reel.isExternal;
  const [commentCount, setCommentCount] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!reel.isExternal) getReelCommentCount(reel.id).then((n) => alive && setCommentCount(n));
    return () => {
      alive = false;
    };
  }, [reel.id, reel.isExternal]);

  const like = () => {
    if (!canLike) return;
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.4, duration: 110, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 110, useNativeDriver: true }),
    ]).start();
    onLike(reel);
  };

  return (
    <View style={{ height: itemHeight, width: '100%', backgroundColor: '#000' }}>
      {reel.isExternal ? (
        active ? (
          <View style={{ width, height: itemHeight, justifyContent: 'center' }}>
            <YoutubePlayer
              height={itemHeight}
              width={width}
              videoId={reel.videoId}
              play={active}
              mute={muted}
              initialPlayerParams={{ controls: false, modestbranding: true, rel: false, loop: true }}
              webViewStyle={{ opacity: 0.9999 }} // avoids a common blank-frame glitch on Android
            />
          </View>
        ) : (
          <Pressable onPress={onToggleMute} style={{ flex: 1 }}>
            <Image source={{ uri: reel.thumbnail }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          </Pressable>
        )
      ) : (
        <Pressable onPress={onToggleMute} style={{ flex: 1 }}>
          <Video
            source={{ uri: reel.videoURL }}
            style={{ width: '100%', height: '100%' }}
            resizeMode={ResizeMode.COVER}
            isLooping
            shouldPlay={active}
            isMuted={muted}
          />
        </Pressable>
      )}

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: 28 }} pointerEvents="box-none">
        {reel.isExternal ? (
          <Pressable onPress={() => reel.youtubeUrl && Linking.openURL(reel.youtubeUrl)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="logo-youtube" size={18} color="#FF0000" />
            </View>
            <T weight="semibold" color="#fff" size={14} numberOfLines={1} style={{ maxWidth: '75%' }}>{reel.authorName}</T>
          </Pressable>
        ) : (
          <Pressable onPress={() => onOpenAuthor(reel.authorId)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Avatar uri={author?.photoURL} name={author?.name} size={34} />
            <T weight="semibold" color="#fff" size={14}>{author?.username || author?.name || 'User'}</T>
          </Pressable>
        )}
        {reel.caption ? <T color="#fff" size={13} numberOfLines={2} style={{ maxWidth: '80%' }}>{reel.caption}</T> : null}
      </View>

      <View style={{ position: 'absolute', right: 12, bottom: 90, alignItems: 'center', gap: 22 }}>
        <Pressable onPress={like} hitSlop={10} style={{ alignItems: 'center', opacity: canLike ? 1 : 0.5 }}>
          <Animated.View style={{ transform: [{ scale }] }}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={32} color={liked ? '#F43F5E' : '#fff'} />
          </Animated.View>
          {canLike ? <T size={12} color="#fff" style={{ marginTop: 2 }}>{likes.length}</T> : null}
        </Pressable>

        {!reel.isExternal ? (
          <Pressable onPress={() => onOpenComments(reel)} hitSlop={10} style={{ alignItems: 'center' }}>
            <Ionicons name="chatbubble-outline" size={28} color="#fff" />
            {commentCount ? <T size={12} color="#fff" style={{ marginTop: 2 }}>{commentCount}</T> : null}
          </Pressable>
        ) : null}

        <Pressable onPress={onToggleMute} hitSlop={10}>
          <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={26} color="#fff" />
        </Pressable>
        {reel.authorId === meId ? (
          <Pressable onPress={() => onDelete(reel)} hitSlop={10}>
            <Ionicons name="trash-outline" size={24} color="#fff" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function TabPill({ label, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16,
        backgroundColor: active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.15)',
      }}
    >
      <T weight="semibold" size={13} color={active ? '#111' : '#fff'}>{label}</T>
    </Pressable>
  );
}

function ReelCommentsSheet({ reel, meId, onClose }) {
  const { colors, fonts } = useTheme();
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => (reel ? subscribeReelComments(reel.id, setComments) : undefined), [reel?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async () => {
    const t = text.trim();
    if (!t || !reel) return;
    setText('');
    setSending(true);
    try {
      await addReelComment(reel.id, { id: meId }, t);
    } catch (e) {
      setText(t);
      Alert.alert('Comment not sent', e.message);
    } finally {
      setSending(false);
    }
  };

  const remove = (c) =>
    Alert.alert('Delete comment?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteReelComment(reel.id, c.id).catch(() => {}) },
    ]);

  return (
    <Modal visible={!!reel} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ height: '65%', backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' }}>
          <View style={{ alignItems: 'center', paddingVertical: 10 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
          </View>
          <T weight="semibold" size={15} style={{ textAlign: 'center', marginBottom: 8 }}>Comments</T>
          <FlatList
            data={comments}
            keyExtractor={(c) => c.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 8 }}
            renderItem={({ item }) => (
              <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 8 }}>
                <Avatar uri={item.authorPhoto} name={item.authorName} size={30} />
                <View style={{ flex: 1 }}>
                  <T size={14}>
                    <T weight="semibold" size={14}>{item.authorName} </T>
                    {item.text}
                  </T>
                  <T size={11} color="subtext" style={{ marginTop: 2 }}>{timeAgo(item.createdAt)}</T>
                </View>
                {item.authorId === meId || reel?.authorId === meId ? (
                  <Pressable onPress={() => remove(item)} hitSlop={10}>
                    <Ionicons name="trash-outline" size={16} color={colors.subtext} />
                  </Pressable>
                ) : null}
              </View>
            )}
            ListEmptyComponent={<T color="subtext" style={{ textAlign: 'center', paddingVertical: 20 }}>No comments yet — be the first!</T>}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 10, gap: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
            <TextInput
              value={text} onChangeText={setText} placeholder="Add a comment…" placeholderTextColor={colors.subtext}
              style={{
                flex: 1, height: 40, backgroundColor: colors.inputBg, borderRadius: 20, paddingHorizontal: 16,
                fontFamily: fonts.regular, fontSize: 14, color: colors.text,
              }}
            />
            <Pressable onPress={send} disabled={!text.trim() || sending} hitSlop={10} style={{ opacity: text.trim() ? 1 : 0.4 }}>
              <T weight="semibold" size={14} color="primary">Post</T>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function ReelsScreen({ navigation }) {
  const { me } = useAuth();
  const { friendIds, friendProfiles } = useAppData();
  const { colors } = useTheme();
  const { vibrate } = useSettings();
  const { height } = useWindowDimensions();
  const [tab, setTab] = useState('discover'); // 'discover' (YouTube Shorts) | 'friends'
  const [friendReels, setFriendReels] = useState([]);
  const [discoverReels, setDiscoverReels] = useState([]);
  const [discoverPageToken, setDiscoverPageToken] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [commentsReel, setCommentsReel] = useState(null);

  const audienceKey = [me.id, ...friendIds].sort().join(',');
  const people = { [me.id]: me, ...friendProfiles };
  const reels = tab === 'discover' ? discoverReels : friendReels;

  const loadFriends = useCallback(async () => {
    try {
      setFriendReels(await fetchReels(audienceKey.split(',')));
    } catch (e) {
      console.warn('reels load failed', e);
    }
  }, [audienceKey]);

  const loadDiscover = useCallback(async (pageToken = null, append = false) => {
    try {
      const { items, nextPageToken } = await fetchShorts(pageToken);
      setDiscoverReels((prev) => (append ? [...prev, ...items] : items));
      setDiscoverPageToken(nextPageToken);
    } catch (e) {
      if (!append) Alert.alert('Could not load Discover', e.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      Promise.all([loadFriends(), discoverReels.length ? null : loadDiscover(null)]).finally(() => setLoading(false));
      return () => setActiveIndex(-1); // pause all videos when the tab loses focus
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadFriends])
  );

  const onEndReached = () => {
    if (tab !== 'discover' || loadingMore || !discoverPageToken) return;
    setLoadingMore(true);
    loadDiscover(discoverPageToken, true).finally(() => setLoadingMore(false));
  };

  const onRefresh = () => {
    setRefreshing(true);
    const job = tab === 'discover' ? loadDiscover(null) : loadFriends();
    job.finally(() => setRefreshing(false));
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length) setActiveIndex(viewableItems[0].index ?? 0);
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 70 }).current;

  const onLike = (reel) => {
    const liked = (reel.likes || []).includes(me.id);
    setFriendReels((rs) =>
      rs.map((r) =>
        r.id === reel.id ? { ...r, likes: liked ? r.likes.filter((x) => x !== me.id) : [...(r.likes || []), me.id] } : r
      )
    );
    if (!liked) vibrate(15);
    toggleReelLike(reel.id, me.id, liked).catch(() => loadFriends());
  };

  const onDelete = (reel) =>
    Alert.alert('Delete reel?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          setFriendReels((rs) => rs.filter((r) => r.id !== reel.id));
          await deleteReel(reel).catch(() => {});
        },
      },
    ]);

  const header = (
    <View style={{ position: 'absolute', top: 50, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', zIndex: 5 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TabPill label="Discover" active={tab === 'discover'} onPress={() => setTab('discover')} />
        <TabPill label="Friends" active={tab === 'friends'} onPress={() => setTab('friends')} />
      </View>
      <Pressable onPress={() => navigation.navigate('Create', { mode: 'reel' })}>
        <Ionicons name="add-circle" size={32} color="#fff" />
      </Pressable>
    </View>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {header}
      {!reels.length ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <EmptyState
            icon="videocam-outline"
            title={tab === 'discover' ? 'Nothing to discover yet' : 'No reels from friends yet'}
            text={tab === 'discover' ? 'Pull down to try again.' : 'Share a short video, or add friends to see theirs here.'}
            actionLabel={tab === 'friends' ? 'Create a reel' : undefined}
            onAction={() => navigation.navigate('Create', { mode: 'reel' })}
          />
        </View>
      ) : (
        <FlatList
          key={tab}
          data={reels}
          keyExtractor={(r) => r.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={height}
          decelerationRate="fast"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
          onEndReachedThreshold={2}
          onEndReached={onEndReached}
          renderItem={({ item, index }) => (
            <ReelItem
              reel={item} author={people[item.authorId]} meId={me.id} itemHeight={height}
              active={index === activeIndex} muted={muted} onToggleMute={() => setMuted((m) => !m)}
              onLike={onLike} onDelete={onDelete} onOpenComments={setCommentsReel}
              onOpenAuthor={(uid) => (uid === me.id ? navigation.navigate('Profile') : navigation.navigate('UserProfile', { userId: uid }))}
            />
          )}
        />
      )}

      <ReelCommentsSheet reel={commentsReel} meId={me.id} onClose={() => setCommentsReel(null)} />
    </View>
  );
}
