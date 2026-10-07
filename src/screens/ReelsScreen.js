import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Keyboard,
  Pressable,
  RefreshControl,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { WebView } from 'react-native-webview';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';

import { fetchShorts } from '../services/youtube';

import { fetchReels, toggleReelLike } from '../services/reels';
import {
  addReelComment,
  deleteReelComment,
  fetchReelComments,
} from '../services/reelComments';


/* =======================================================
   HELPERS
======================================================= */

const normalizeReelsResult = (result) => {
  if (Array.isArray(result)) {
    return result;
  }

  if (Array.isArray(result?.reels)) {
    return result.reels;
  }

  if (Array.isArray(result?.items)) {
    return result.items;
  }

  if (Array.isArray(result?.data)) {
    return result.data;
  }

  if (Array.isArray(result?.results)) {
    return result.results;
  }

  return [];
};


/* =======================================================
   SCREEN
======================================================= */

export default function ReelsScreen() {
  const {
    width,
    height,
  } = useWindowDimensions();

  const { me } = useAuth();
  const navigation = useNavigation();
  const focused = useIsFocused();

  const { friendIds } = useAppData();


  /* -------------------------------------------------------
     STATE
  ------------------------------------------------------- */

  const [
    activeTab,
    setActiveTab,
  ] = useState('discover');

  const [
    discoverReels,
    setDiscoverReels,
  ] = useState([]);

  const [
    friendReels,
    setFriendReels,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    loadingMore,
    setLoadingMore,
  ] = useState(false);

  const [
    activeIndex,
    setActiveIndex,
  ] = useState(0);

  const [
    nextPageToken,
    setNextPageToken,
  ] = useState(null);

  const [muted, setMuted] = useState(false);

  const [
    searchText,
    setSearchText,
  ] = useState('');

  const [
    activeSearch,
    setActiveSearch,
  ] = useState('');


  /* -------------------------------------------------------
     COMMENTS
  ------------------------------------------------------- */

  const [
    commentCounts,
    setCommentCounts,
  ] = useState({});

  const [
    comments,
    setComments,
  ] = useState([]);

  const [
    commentSheetVisible,
    setCommentSheetVisible,
  ] = useState(false);

  const [
    selectedReel,
    setSelectedReel,
  ] = useState(null);


  /* -------------------------------------------------------
     REFS
  ------------------------------------------------------- */

  const listRef =
    useRef(null);

  const mountedRef =
    useRef(true);

  const friendsLoadedRef =
    useRef(false);

  /*
   * Forces a fresh YouTube player when
   * changing the active video.
   */
  const youtubePlayerKey =
    useRef(0);

  /*
   * Reference to the currently rendered
   * YouTube player.
   *
   * We use this to explicitly call
   * playVideo() when the player becomes
   * ready.
   */
  const youtubePlayerRef =
    useRef(null);


  /* =======================================================
     MOUNT
  ======================================================= */

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);


  /* =======================================================
     LOAD DISCOVER / SEARCH
  ======================================================= */

  const loadDiscover =
    useCallback(
      async (
        refresh = false,
        queryOverride = null
      ) => {
        try {
          if (refresh) {
            setRefreshing(true);
          } else {
            setLoading(true);
          }

          const query =
            queryOverride !== null
              ? queryOverride
              : activeSearch;

          const result =
            await fetchShorts(
              refresh
                ? null
                : nextPageToken,
              query
            );

          if (!mountedRef.current) {
            return;
          }

          const items =
            Array.isArray(result?.items)
              ? result.items
              : [];

          if (refresh) {
            setDiscoverReels(items);

            setNextPageToken(
              result?.nextPageToken ||
              null
            );

            setActiveIndex(0);


            setTimeout(() => {
              listRef.current?.scrollToOffset({
                offset: 0,
                animated: false,
              });
            }, 50);
          } else {
            setDiscoverReels(
              (previous) => {
                const oldItems =
                  Array.isArray(previous)
                    ? previous
                    : [];

                const existingIds =
                  new Set(
                    oldItems.map(
                      (item) =>
                        item?.videoId ||
                        item?.id
                    )
                  );

                const newItems =
                  items.filter(
                    (item) =>
                      item &&
                      !existingIds.has(
                        item.videoId ||
                        item.id
                      )
                  );

                return [
                  ...oldItems,
                  ...newItems,
                ];
              }
            );

            setNextPageToken(
              result?.nextPageToken ||
              null
            );
          }
        } catch (error) {
          console.error(
            'Discover load error:',
            error
          );

          if (mountedRef.current) {
            Alert.alert(
              'YouTube',
              error?.message ||
                'Could not load YouTube videos.'
            );
          }
        } finally {
          if (!mountedRef.current) {
            return;
          }

          setLoading(false);
          setRefreshing(false);
        }
      },
      [
        activeSearch,
        nextPageToken,
      ]
    );


  /* =======================================================
     FRIEND VIDEOS
  ======================================================= */

  const loadFriendReels =
    useCallback(
      async (
        forceRefresh = false
      ) => {
        if (!me?.id) {
          if (mountedRef.current) {
            setFriendReels([]);
          }

          return;
        }

        try {
          if (
            !forceRefresh &&
            friendsLoadedRef.current
          ) {
            return;
          }

          setLoading(true);

          const result =
            await fetchReels([me.id, ...friendIds]);

          if (!mountedRef.current) {
            return;
          }

          const reels =
            normalizeReelsResult(result);

          setFriendReels(reels);

          friendsLoadedRef.current = true;

          setActiveIndex(0);
        } catch (error) {
          console.error(
            'Friends videos error:',
            error
          );

          if (mountedRef.current) {
            setFriendReels([]);

            Alert.alert(
              'Friends Videos',
              error?.message ||
                'Could not load friend videos.'
            );
          }
        } finally {
          if (mountedRef.current) {
            setLoading(false);
          }
        }
      },
      [me?.id, friendIds]
    );


  const openUpload = () => {
    friendsLoadedRef.current = false;
    navigation.navigate('Create', { mode: 'reel' });
  };

  // Reload my friends' videos when coming back (e.g. after uploading one)
  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'friends' && !friendsLoadedRef.current) {
        loadFriendReels(true);
      }
    }, [activeTab, loadFriendReels])
  );

  /* =======================================================
     INITIAL DISCOVER
  ======================================================= */

  useEffect(() => {
    loadDiscover(true, '');
  }, []);


  /* =======================================================
     TAB CHANGE
  ======================================================= */

  useEffect(() => {
    if (activeTab === 'friends') {
      loadFriendReels();
    }
  }, [
    activeTab,
    loadFriendReels,
  ]);


  /* =======================================================
     DATA
  ======================================================= */

  const data =
    activeTab === 'discover'
      ? Array.isArray(discoverReels)
        ? discoverReels
        : []
      : Array.isArray(friendReels)
        ? friendReels
        : [];


  /* =======================================================
     SEARCH
  ======================================================= */

  const performSearch =
    async () => {
      const query =
        searchText.trim();

      Keyboard.dismiss();

      setActiveSearch(query);

      setNextPageToken(null);

      setActiveIndex(0);

      await loadDiscover(
        true,
        query
      );
    };


  const clearSearch =
    async () => {
      Keyboard.dismiss();

      setSearchText('');

      setActiveSearch('');

      setNextPageToken(null);

      setActiveIndex(0);

      await loadDiscover(
        true,
        ''
      );
    };


  /* =======================================================
     REFRESH
  ======================================================= */

  const handleRefresh =
    useCallback(
      async () => {
        if (activeTab === 'discover') {
          setNextPageToken(null);

          await loadDiscover(
            true,
            activeSearch
          );
        } else {
          friendsLoadedRef.current = false;

          await loadFriendReels(true);
        }
      },
      [
        activeTab,
        activeSearch,
        loadDiscover,
        loadFriendReels,
      ]
    );


  /* =======================================================
     LOAD MORE
  ======================================================= */

  const handleLoadMore =
    useCallback(
      async () => {
        if (activeTab !== 'discover') {
          return;
        }

        if (
          loadingMore ||
          loading ||
          !nextPageToken
        ) {
          return;
        }

        try {
          setLoadingMore(true);

          const result =
            await fetchShorts(
              nextPageToken,
              activeSearch
            );

          if (!mountedRef.current) {
            return;
          }

          const items =
            Array.isArray(result?.items)
              ? result.items
              : [];

          setDiscoverReels(
            (previous) => {
              const oldItems =
                Array.isArray(previous)
                  ? previous
                  : [];

              const existingIds =
                new Set(
                  oldItems.map(
                    (item) =>
                      item?.videoId ||
                      item?.id
                  )
                );

              const newItems =
                items.filter(
                  (item) =>
                    item &&
                    !existingIds.has(
                      item.videoId ||
                      item.id
                    )
                );

              return [
                ...oldItems,
                ...newItems,
              ];
            }
          );

          setNextPageToken(
            result?.nextPageToken ||
            null
          );
        } catch (error) {
          console.error(
            'Load more error:',
            error
          );
        } finally {
          if (mountedRef.current) {
            setLoadingMore(false);
          }
        }
      },
      [
        activeTab,
        activeSearch,
        loadingMore,
        loading,
        nextPageToken,
      ]
    );


  /* =======================================================
     VIEWABILITY
  ======================================================= */

  const onViewableItemsChanged =
    useRef(
      ({
        viewableItems,
      }) => {
        if (!viewableItems?.length) {
          return;
        }

        const first =
          viewableItems[0];

        if (
          first?.index !== null &&
          first?.index !== undefined
        ) {
          setActiveIndex(first.index);
        }
      }
    ).current;


  const viewabilityConfig =
    useRef({
      itemVisiblePercentThreshold: 70,
    }).current;


  /* =======================================================
     LIKE
  ======================================================= */

  const handleLike =
    async (item) => {
      if (
        !me?.id ||
        !item?.id
      ) {
        return;
      }

      try {
        const wasLiked =
          Array.isArray(item.likes) &&
          item.likes.includes(me.id);

        await toggleReelLike(
          item.id,
          me.id,
          wasLiked
        );

        const updateList =
          (list) =>
            list.map(
              (reel) => {
                if (
                  reel.id !== item.id
                ) {
                  return reel;
                }

                const likes =
                  Array.isArray(
                    reel.likes
                  )
                    ? reel.likes
                    : [];

                const alreadyLiked =
                  likes.includes(
                    me.id
                  );

                return {
                  ...reel,

                  likes:
                    alreadyLiked
                      ? likes.filter(
                          (id) =>
                            id !==
                            me.id
                        )
                      : [
                          ...likes,
                          me.id,
                        ],
                };
              }
            );

        if (activeTab === 'discover') {
          setDiscoverReels(updateList);
        } else {
          setFriendReels(updateList);
        }
      } catch (error) {
        console.error(
          'Like error:',
          error
        );
      }
    };


  /* =======================================================
     COMMENTS
  ======================================================= */

  const openComments =
    async (item) => {
      if (!item?.id) {
        return;
      }

      setSelectedReel(item);

      setCommentSheetVisible(true);

      try {
        const result =
          await fetchReelComments(item.id);

        if (!mountedRef.current) {
          return;
        }

        const loadedComments =
          Array.isArray(result)
            ? result
            : Array.isArray(result?.comments)
              ? result.comments
              : [];

        setComments(loadedComments);

        setCommentCounts(
          (previous) => ({
            ...previous,
            [item.id]:
              loadedComments.length,
          })
        );
      } catch (error) {
        console.error(
          'Comments error:',
          error
        );
      }
    };


  const submitComment =
    async (text) => {
      if (
        !me?.id ||
        !selectedReel?.id ||
        !text?.trim()
      ) {
        return;
      }

      try {
        await addReelComment(
          selectedReel.id,
          me,
          text.trim()
        );

        const result =
          await fetchReelComments(
            selectedReel.id
          );

        const loadedComments =
          Array.isArray(result)
            ? result
            : Array.isArray(result?.comments)
              ? result.comments
              : [];

        if (!mountedRef.current) {
          return;
        }

        setComments(loadedComments);

        setCommentCounts(
          (previous) => ({
            ...previous,
            [selectedReel.id]:
              loadedComments.length,
          })
        );
      } catch (error) {
        console.error(
          'Add comment error:',
          error
        );
      }
    };


  const removeComment =
    async (commentId) => {
      if (!commentId || !selectedReel?.id) {
        return;
      }

      try {
        await deleteReelComment(selectedReel.id, commentId);

        if (!selectedReel?.id) {
          return;
        }

        const result =
          await fetchReelComments(
            selectedReel.id
          );

        const loadedComments =
          Array.isArray(result)
            ? result
            : Array.isArray(result?.comments)
              ? result.comments
              : [];

        if (!mountedRef.current) {
          return;
        }

        setComments(loadedComments);

        setCommentCounts(
          (previous) => ({
            ...previous,
            [selectedReel.id]:
              loadedComments.length,
          })
        );
      } catch (error) {
        console.error(
          'Delete comment error:',
          error
        );
      }
    };


  /* =======================================================
     FRIEND VIDEO
  ======================================================= */

  const renderFriendVideo =
    (
      item,
      index
    ) => {
      const isActive =
        index === activeIndex;

      const uri =
        item?.videoURL ||
    item?.videoUrl ||
        item?.url ||
        item?.video ||
        item?.mediaUrl;

      if (!uri) {
        return (
          <View
            style={{
              width,
              height,
              backgroundColor: '#000',
            }}
          />
        );
      }

      return (
        <View
          style={{
            width,
            height,
            backgroundColor: '#000',
          }}
        >
          <Video
            source={{ uri }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
            isMuted={muted}
            resizeMode={ResizeMode.COVER}
            shouldPlay={isActive && focused}
            isLooping
            useNativeControls={false}
          />

          <View
            style={{
              position: 'absolute',
              left: 16,
              right: 16,
              bottom: 35,
            }}
          >
            <Animated.Text
              style={{
                color: '#fff',
                fontSize: 16,
                fontWeight: '600',
              }}
            >
              {item?.caption ||
                item?.title ||
                ''}
            </Animated.Text>
          </View>
        </View>
      );
    };


  /* =======================================================
     YOUTUBE VIDEO
  ======================================================= */

  const renderYoutubeVideo =
    (item, index) => {
      const isActive = index === activeIndex;

      if (!item?.videoId) {
        return (
          <View
            style={{
              width,
              height,
              backgroundColor: '#000',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Ionicons name="logo-youtube" size={50} color="#555" />
          </View>
        );
      }

      return (
        <View
          style={{
            width,
            height,
            backgroundColor: '#000',
            overflow: 'hidden',
          }}
        >
          {/* Only the visible video gets a player: it fills the whole
              screen (9:16 shorts fill a portrait box) and autoplays. */}
          {isActive && focused && (
            <WebView
              key={`${item.videoId}-${muted ? 'm' : 'u'}`}
              pointerEvents="none"
              style={{
                width,
                height,
                backgroundColor: '#000',
              }}
              originWhitelist={['*']}
              source={{
                baseUrl: 'https://www.youtube.com',
                html: `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>html,body{margin:0;padding:0;width:100%;height:100%;background:#000;overflow:hidden}
iframe{position:fixed;top:0;left:0;width:100%;height:100%;border:0}</style></head><body>
<iframe src="https://www.youtube.com/embed/${item.videoId}?autoplay=1&mute=${muted ? 1 : 0}&controls=0&loop=1&playlist=${item.videoId}&playsinline=1&modestbranding=1&rel=0&iv_load_policy=3&fs=0&disablekb=1"
allow="autoplay; encrypted-media" allowfullscreen></iframe></body></html>`,
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
          )}

          {/* Title + channel */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 16,
              right: 80,
              bottom: 40,
            }}
          >
            <Animated.Text
              numberOfLines={2}
              style={{
                color: '#fff',
                fontSize: 16,
                fontWeight: '700',
                textShadowColor: 'rgba(0,0,0,0.8)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 4,
              }}
            >
              {item?.title || 'YouTube Video'}
            </Animated.Text>
            <Animated.Text
              numberOfLines={1}
              style={{
                color: '#ddd',
                fontSize: 13,
                marginTop: 5,
                textShadowColor: 'rgba(0,0,0,0.8)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 4,
              }}
            >
              {item?.authorName || item?.channelTitle || 'YouTube'}
            </Animated.Text>
          </View>

          {/* Mute / unmute */}
          <Pressable
            onPress={() => setMuted((m) => !m)}
            hitSlop={12}
            style={{
              position: 'absolute',
              right: 16,
              bottom: 120,
              width: 46,
              height: 46,
              borderRadius: 23,
              backgroundColor: 'rgba(0,0,0,0.5)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Ionicons
              name={muted ? 'volume-mute' : 'volume-high'}
              size={24}
              color="#fff"
            />
          </Pressable>
        </View>
      );
    };


  /* =======================================================
     RENDER ITEM
  ======================================================= */

  const renderItem =
    ({
      item,
      index,
    }) => {
      const isYoutube =
        activeTab === 'discover' ||
        item?.isExternal === true ||
        !!item?.videoId;

      if (isYoutube) {
        return renderYoutubeVideo(
          item,
          index
        );
      }

      return renderFriendVideo(
        item,
        index
      );
    };


  /* =======================================================
     EMPTY
  ======================================================= */

  const renderEmpty =
    () => {
      if (loading) {
        return (
          <View
            style={{
              flex: 1,
              height,
              backgroundColor: '#000',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <ActivityIndicator
              size="large"
              color="#fff"
            />
          </View>
        );
      }

      return (
        <View
          style={{
            flex: 1,
            height,
            backgroundColor: '#000',
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 30,
          }}
        >
          <Ionicons
            name={
              activeTab === 'discover'
                ? 'logo-youtube'
                : 'people-outline'
            }
            size={55}
            color="#777"
          />

          <Animated.Text
            style={{
              color: '#fff',
              fontSize: 18,
              fontWeight: '700',
              marginTop: 15,
              textAlign: 'center',
            }}
          >
            {activeTab === 'discover'
              ? activeSearch
                ? `No videos found for "${activeSearch}"`
                : 'No videos available'
              : 'No friend videos yet'}
          </Animated.Text>

          <Animated.Text
            style={{
              color: '#999',
              fontSize: 14,
              marginTop: 8,
              textAlign: 'center',
            }}
          >
            {activeTab === 'discover'
              ? 'Try another YouTube search.'
              : 'Your friends’ uploaded videos will appear here.'}
          </Animated.Text>

          {activeTab === 'friends' && (
            <Pressable
              onPress={openUpload}
              style={{
                marginTop: 20,
                paddingHorizontal: 22,
                paddingVertical: 12,
                borderRadius: 24,
                backgroundColor: '#E11D2A',
              }}
            >
              <Animated.Text
                style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}
              >
                Upload a video
              </Animated.Text>
            </Pressable>
          )}
        </View>
      );
    };


  /* =======================================================
     MAIN UI
  ======================================================= */

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#000',
      }}
    >

      {/* =================================================
          TOP AREA
      ================================================= */}

      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          paddingTop: 38,
          paddingHorizontal: 12,
        }}
      >

        {/* TABS */}

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >

          <Pressable
            onPress={() => {
              setActiveTab('discover');
              setActiveIndex(0);
            }}
            style={{
              paddingHorizontal: 18,
              paddingVertical: 8,
            }}
          >
            <Animated.Text
              style={{
                color:
                  activeTab === 'discover'
                    ? '#fff'
                    : '#888',
                fontSize: 16,
                fontWeight:
                  activeTab === 'discover'
                    ? '800'
                    : '500',
              }}
            >
              Videos
            </Animated.Text>
          </Pressable>


          <Pressable
            onPress={() => {
              setActiveTab('friends');
              setActiveIndex(0);
            }}
            style={{
              paddingHorizontal: 18,
              paddingVertical: 8,
            }}
          >
            <Animated.Text
              style={{
                color:
                  activeTab === 'friends'
                    ? '#fff'
                    : '#888',
                fontSize: 16,
                fontWeight:
                  activeTab === 'friends'
                    ? '800'
                    : '500',
              }}
            >
              Friends
            </Animated.Text>
          </Pressable>

        </View>


      {/* UPLOAD BUTTON (friends tab) */}
        {activeTab === 'friends' && (
          <Pressable
            onPress={openUpload}
            hitSlop={10}
            style={{
              position: 'absolute',
              right: 16,
              top: 38,
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: '#E11D2A',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Ionicons name="add" size={26} color="#fff" />
          </Pressable>
        )}

          {/* YOUTUBE SEARCH BAR */}

        {activeTab === 'discover' && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: 6,
              marginBottom: 5,
            }}
          >

            <View
              style={{
                flex: 1,
                height: 42,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor:
                  'rgba(25,25,25,0.95)',
                borderRadius: 22,
                paddingHorizontal: 14,
                borderWidth: 1,
                borderColor:
                  'rgba(255,255,255,0.15)',
              }}
            >

              <Ionicons
                name="search"
                size={20}
                color="#aaa"
              />

              <TextInput
                value={searchText}
                onChangeText={setSearchText}
                onSubmitEditing={performSearch}
                returnKeyType="search"
                placeholder="Search on YouTube"
                placeholderTextColor="#888"
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  flex: 1,
                  color: '#fff',
                  fontSize: 14,
                  marginLeft: 9,
                  paddingVertical: 0,
                }}
              />

              {searchText.length > 0 && (
                <Pressable
                  onPress={clearSearch}
                  style={{
                    padding: 4,
                  }}
                >
                  <Ionicons
                    name="close-circle"
                    size={19}
                    color="#888"
                  />
                </Pressable>
              )}

            </View>


            <Pressable
              onPress={performSearch}
              style={{
                width: 42,
                height: 42,
                marginLeft: 8,
                borderRadius: 21,
                backgroundColor: '#fff',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Ionicons
                name="arrow-forward"
                size={20}
                color="#000"
              />
            </Pressable>

          </View>
        )}

      </View>


      {/* =================================================
          VIDEO FEED
      ================================================= */}

      <FlatList
        ref={listRef}

        data={data}

        keyExtractor={(
          item,
          index
        ) =>
          String(
            item?.id ||
            item?.videoId ||
            `video-${index}`
          )
        }

        renderItem={renderItem}

        pagingEnabled
  getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}

        showsVerticalScrollIndicator={false}

        snapToAlignment="start"

        decelerationRate="fast"

        initialNumToRender={1}

        maxToRenderPerBatch={2}

        windowSize={3}

        removeClippedSubviews={false}

        onViewableItemsChanged={
          onViewableItemsChanged
        }

        viewabilityConfig={
          viewabilityConfig
        }

        onEndReached={
          activeTab === 'discover'
            ? handleLoadMore
            : undefined
        }

        onEndReachedThreshold={0.6}

        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#fff"
            colors={['#fff']}
          />
        }

        ListEmptyComponent={renderEmpty}

        ListFooterComponent={
          loadingMore ? (
            <View
              style={{
                height: 80,
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: '#000',
              }}
            >
              <ActivityIndicator color="#fff" />
            </View>
          ) : null
        }
      />


      {/* COMMENT SHEET PLACEHOLDER */}

      {commentSheetVisible && (
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
          }}
        />
      )}

    </View>
  );
}