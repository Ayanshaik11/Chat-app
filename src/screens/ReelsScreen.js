import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, FlatList, Pressable, RefreshControl, View, useWindowDimensions,
} from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import { fetchShorts } from '../services/youtube';
import { fetchReels, toggleLikeReel, addComment, deleteComment, fetchComments } from '../services/reels';

/* =======================================================
   HELPERS
======================================================= */

const normalizeReelsResult = (result) => {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.reels)) return result.reels;
  if (Array.isArray(result?.items)) return result.items;
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.results)) return result.results;
  return [];
};

/* =======================================================
   YOUTUBE PLAYER ITEM — separate component so it can hold its own
   ref and reliably force-start playback once the player is ready.
   Relying on the `play` prop alone can silently no-op on Android
   the moment a video first becomes active, before the player has
   actually finished loading.
======================================================= */

function YoutubeReelItem({ item, isActive, muted, onToggleMute, width, height }) {
  const playerRef = useRef(null);
  const readyRef = useRef(false);

  // YouTube's embedded player always renders at a fixed 16:9 (landscape)
  // shape no matter what size is requested — so it's rendered at that
  // natural size, then the whole thing is zoomed up until it covers the
  // full vertical screen, the same way a real Shorts video fills it.
  const nativeWidth = width;
  const nativeHeight = Math.round(nativeWidth * (9 / 16));
  const coverScale = height / nativeHeight;

  const tryPlay = useCallback(() => {
    if (isActive && readyRef.current) playerRef.current?.playVideo?.();
  }, [isActive]);

  // Fires once the WebView player has actually loaded and is controllable —
  // this is the reliable moment to force playback, not just the `play` prop.
  const onReady = useCallback(() => {
    readyRef.current = true;
    tryPlay();
  }, [tryPlay]);

  // Also catches the case where this item was already ready and becomes
  // active later (e.g. swiping back to it) without a fresh mount.
  useEffect(() => {
    tryPlay();
    if (!isActive) playerRef.current?.pauseVideo?.();
  }, [isActive, tryPlay]);

  return (
    <View style={{ width, height, backgroundColor: '#000', overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: nativeWidth, height: nativeHeight, transform: [{ scale: coverScale }] }}>
        <YoutubePlayer
          ref={playerRef}
          width={nativeWidth}
          height={nativeHeight}
          videoId={item.videoId}
          play={isActive}
          mute={muted}
          forceAndroidAutoplay
          webViewProps={{
            allowsInlineMediaPlayback: true,
            mediaPlaybackRequiresUserAction: false,
            androidLayerType: 'hardware',
            javaScriptEnabled: true,
            domStorageEnabled: true,
          }}
          initialPlayerParams={{ controls: false, modestbranding: true, rel: false, loop: true, playsinline: 1 }}
          onReady={onReady}
          onChangeState={(state) => console.log('YouTube state:', state, item.videoId)}
          onError={(error) => console.log('YouTube error:', error, item.videoId)}
        />
      </View>

      {/* tap anywhere on the video to mute/unmute — same as Instagram/TikTok */}
      <Pressable onPress={onToggleMute} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />

      <Pressable
        onPress={onToggleMute}
        hitSlop={12}
        style={{ position: 'absolute', right: 16, bottom: 130, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' }}
      >
        <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={20} color="#fff" />
      </Pressable>

      <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom: 35 }}>
        <Animated.Text
          numberOfLines={2}
          style={{ color: '#fff', fontSize: 17, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }}
        >
          {item?.title || 'YouTube Video'}
        </Animated.Text>
        <Animated.Text
          numberOfLines={1}
          style={{ color: '#ddd', fontSize: 13, marginTop: 5, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }}
        >
          {item?.authorName || item?.channelTitle || 'YouTube'}
        </Animated.Text>
      </View>
    </View>
  );
}

/* =======================================================
   SCREEN
======================================================= */

export default function ReelsScreen() {
  const { width, height } = useWindowDimensions();
  const { user } = useAuth();
  useAppData();

  const [activeTab, setActiveTab] = useState('discover');
  const [discoverReels, setDiscoverReels] = useState([]);
  const [friendReels, setFriendReels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [nextPageToken, setNextPageToken] = useState(null);
  const [commentCounts, setCommentCounts] = useState({});
  const [comments, setComments] = useState([]);
  const [commentSheetVisible, setCommentSheetVisible] = useState(false);
  const [selectedReel, setSelectedReel] = useState(null);
  // Starts muted — matches how Instagram/TikTok Reels autoplay, and avoids
  // browsers/WebViews blocking autoplay-with-sound entirely. Tap to unmute.
  const [muted, setMuted] = useState(true);

  const listRef = useRef(null);
  const mountedRef = useRef(true);
  const friendsLoadedRef = useRef(false);
  const youtubePlayerKey = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /* =======================================================
     DISCOVER — YOUTUBE
  ======================================================= */

  const loadDiscover = useCallback(
    async (refresh = false) => {
      try {
        if (refresh) setRefreshing(true);
        else setLoading(true);

        const result = await fetchShorts(refresh ? null : nextPageToken);
        if (!mountedRef.current) return;

        const items = Array.isArray(result?.items) ? result.items : [];

        if (refresh) {
          setDiscoverReels(items);
          setNextPageToken(result?.nextPageToken || null);
          setActiveIndex(0);
          youtubePlayerKey.current += 1;
        } else {
          setDiscoverReels((previous) => {
            const oldItems = Array.isArray(previous) ? previous : [];
            const existingIds = new Set(oldItems.map((item) => item?.videoId || item?.id));
            const newItems = items.filter((item) => item && !existingIds.has(item.videoId || item.id));
            return [...oldItems, ...newItems];
          });
          setNextPageToken(result?.nextPageToken || null);
        }
      } catch (error) {
        console.error('Discover load error:', error);
        if (mountedRef.current) Alert.alert('YouTube', error?.message || 'Could not load YouTube videos.');
      } finally {
        if (!mountedRef.current) return;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [nextPageToken]
  );

  /* =======================================================
     FRIEND REELS
  ======================================================= */

  const loadFriendReels = useCallback(
    async (forceRefresh = false) => {
      if (!user?.uid) {
        if (mountedRef.current) setFriendReels([]);
        return;
      }
      try {
        if (!forceRefresh && friendsLoadedRef.current) return;
        setLoading(true);

        const result = await fetchReels(user.uid);
        if (!mountedRef.current) return;

        setFriendReels(normalizeReelsResult(result));
        friendsLoadedRef.current = true;
        setActiveIndex(0);
      } catch (error) {
        console.error('Friends reels error:', error);
        if (mountedRef.current) {
          setFriendReels([]);
          Alert.alert('Friends Reels', error?.message || 'Could not load friend reels.');
        }
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    [user?.uid]
  );

  useEffect(() => {
    loadDiscover(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === 'friends') loadFriendReels();
  }, [activeTab, loadFriendReels]);

  const data = activeTab === 'discover'
    ? (Array.isArray(discoverReels) ? discoverReels : [])
    : (Array.isArray(friendReels) ? friendReels : []);

  useEffect(() => {
    // Re-creates the YoutubePlayer when the active video changes — helps
    // Android reliably start the newly selected video.
    youtubePlayerKey.current += 1;
  }, [activeIndex, activeTab]);

  const handleRefresh = useCallback(async () => {
    if (activeTab === 'discover') {
      setNextPageToken(null);
      await loadDiscover(true);
    } else {
      friendsLoadedRef.current = false;
      await loadFriendReels(true);
    }
  }, [activeTab, loadDiscover, loadFriendReels]);

  const handleLoadMore = useCallback(async () => {
    if (activeTab !== 'discover') return;
    if (loadingMore || loading || !nextPageToken) return;
    try {
      setLoadingMore(true);
      const result = await fetchShorts(nextPageToken);
      if (!mountedRef.current) return;
      const items = Array.isArray(result?.items) ? result.items : [];
      setDiscoverReels((previous) => {
        const oldItems = Array.isArray(previous) ? previous : [];
        const existingIds = new Set(oldItems.map((item) => item?.videoId || item?.id));
        const newItems = items.filter((item) => item && !existingIds.has(item.videoId || item.id));
        return [...oldItems, ...newItems];
      });
      setNextPageToken(result?.nextPageToken || null);
    } catch (error) {
      console.error('Load more error:', error);
    } finally {
      if (mountedRef.current) setLoadingMore(false);
    }
  }, [activeTab, loadingMore, loading, nextPageToken]);

  /* =======================================================
     VIEWABILITY
  ======================================================= */

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (!viewableItems?.length) return;
    const first = viewableItems[0];
    if (first?.index !== null && first?.index !== undefined) setActiveIndex(first.index);
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 70 }).current;

  /* =======================================================
     LIKE
  ======================================================= */

  const handleLike = async (item) => {
    if (!user?.uid || !item?.id) return;
    try {
      await toggleLikeReel(item.id, user.uid);
      const updateList = (list) =>
        list.map((reel) => {
          if (reel.id !== item.id) return reel;
          const likes = Array.isArray(reel.likes) ? reel.likes : [];
          const alreadyLiked = likes.includes(user.uid);
          return { ...reel, likes: alreadyLiked ? likes.filter((id) => id !== user.uid) : [...likes, user.uid] };
        });
      if (activeTab === 'discover') setDiscoverReels(updateList);
      else setFriendReels(updateList);
    } catch (error) {
      console.error('Like error:', error);
    }
  };

  /* =======================================================
     COMMENTS
  ======================================================= */

  const openComments = async (item) => {
    if (!item?.id) return;
    setSelectedReel(item);
    setCommentSheetVisible(true);
    try {
      const result = await fetchComments(item.id);
      if (!mountedRef.current) return;
      const loadedComments = Array.isArray(result) ? result : Array.isArray(result?.comments) ? result.comments : [];
      setComments(loadedComments);
      setCommentCounts((previous) => ({ ...previous, [item.id]: loadedComments.length }));
    } catch (error) {
      console.error('Comments error:', error);
    }
  };

  const submitComment = async (text) => {
    if (!user?.uid || !selectedReel?.id || !text?.trim()) return;
    try {
      await addComment(selectedReel.id, user.uid, text.trim());
      const result = await fetchComments(selectedReel.id);
      const loadedComments = Array.isArray(result) ? result : Array.isArray(result?.comments) ? result.comments : [];
      if (!mountedRef.current) return;
      setComments(loadedComments);
      setCommentCounts((previous) => ({ ...previous, [selectedReel.id]: loadedComments.length }));
    } catch (error) {
      console.error('Add comment error:', error);
    }
  };

  const removeComment = async (commentId) => {
    if (!commentId) return;
    try {
      await deleteComment(commentId);
      if (!selectedReel?.id) return;
      const result = await fetchComments(selectedReel.id);
      const loadedComments = Array.isArray(result) ? result : Array.isArray(result?.comments) ? result.comments : [];
      if (!mountedRef.current) return;
      setComments(loadedComments);
      setCommentCounts((previous) => ({ ...previous, [selectedReel.id]: loadedComments.length }));
    } catch (error) {
      console.error('Delete comment error:', error);
    }
  };

  /* =======================================================
     FRIEND VIDEO — already fills the screen correctly (COVER mode)
  ======================================================= */

  const renderFriendVideo = (item, index) => {
    const isActive = index === activeIndex;
    const uri = item?.videoUrl || item?.url || item?.video || item?.mediaUrl;

    if (!uri) return <View style={{ width, height, backgroundColor: '#000' }} />;

    return (
      <View style={{ width, height, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <Video
          source={{ uri }}
          style={{ width, height }}
          resizeMode={ResizeMode.COVER}
          shouldPlay={isActive}
          isLooping
          useNativeControls={false}
        />
        <View style={{ position: 'absolute', left: 16, right: 16, bottom: 35 }}>
          <Animated.Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
            {item?.caption || item?.title || ''}
          </Animated.Text>
        </View>
      </View>
    );
  };

  /* =======================================================
     YOUTUBE VIDEO — fixed to fill the screen like a real Short
  ======================================================= */

  const renderYoutubeVideo = (item, index) => {
    const isActive = index === activeIndex;
    if (!item?.videoId) {
      return (
        <View style={{ width, height, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="logo-youtube" size={50} color="#555" />
        </View>
      );
    }
    return (
      <YoutubeReelItem
        key={`${item.videoId}-${youtubePlayerKey.current}`}
        item={item}
        isActive={isActive}
        muted={muted}
        onToggleMute={() => setMuted((m) => !m)}
        width={width}
        height={height}
      />
    );
  };

  /* =======================================================
     RENDER ITEM
  ======================================================= */

  const renderItem = ({ item, index }) => {
    const isYoutube = activeTab === 'discover' || item?.isExternal === true || !!item?.videoId;
    return isYoutube ? renderYoutubeVideo(item, index) : renderFriendVideo(item, index);
  };

  /* =======================================================
     EMPTY STATE
  ======================================================= */

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={{ flex: 1, height, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      );
    }
    return (
      <View style={{ flex: 1, height, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 }}>
        <Ionicons name={activeTab === 'discover' ? 'logo-youtube' : 'people-outline'} size={55} color="#777" />
        <Animated.Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 15, textAlign: 'center' }}>
          {activeTab === 'discover' ? 'No videos available' : 'No friend reels yet'}
        </Animated.Text>
        <Animated.Text style={{ color: '#999', fontSize: 14, marginTop: 8, textAlign: 'center' }}>
          {activeTab === 'discover' ? 'Pull down to refresh and try again.' : 'Your friends\u2019 uploaded reels will appear here.'}
        </Animated.Text>
      </View>
    );
  };

  /* =======================================================
     MAIN UI
  ======================================================= */

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingTop: 45, paddingBottom: 12 }}>
        <Pressable onPress={() => { setActiveTab('discover'); setActiveIndex(0); }} style={{ paddingHorizontal: 18, paddingVertical: 8 }}>
          <Animated.Text style={{ color: activeTab === 'discover' ? '#fff' : '#888', fontSize: 16, fontWeight: activeTab === 'discover' ? '800' : '500' }}>
            Discover
          </Animated.Text>
        </Pressable>
        <Pressable onPress={() => { setActiveTab('friends'); setActiveIndex(0); }} style={{ paddingHorizontal: 18, paddingVertical: 8 }}>
          <Animated.Text style={{ color: activeTab === 'friends' ? '#fff' : '#888', fontSize: 16, fontWeight: activeTab === 'friends' ? '800' : '500' }}>
            Friends
          </Animated.Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={(item, index) => String(item?.id || item?.videoId || `reel-${index}`)}
        renderItem={renderItem}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        // Locks each swipe to exactly one screen-height jump — without both
        // of these, pagingEnabled alone can let a fast swipe travel past
        // more than one video.
        snapToInterval={height}
        decelerationRate="fast"
        getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        windowSize={3}
        removeClippedSubviews={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onEndReached={activeTab === 'discover' ? handleLoadMore : undefined}
        onEndReachedThreshold={0.6}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#fff" colors={['#fff']} />}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={
          loadingMore ? (
            <View style={{ height: 80, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : null
        }
      />

      {commentSheetVisible && (
        <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }} />
      )}
    </View>
  );
}
