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
  Pressable,
  RefreshControl,
  View,
  useWindowDimensions,
} from 'react-native';

import { Video, ResizeMode } from 'expo-av';
import YoutubePlayer from 'react-native-youtube-iframe';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';

import { fetchShorts } from '../services/youtube';

import {
  fetchReels,
  toggleLikeReel,
  addComment,
  deleteComment,
  fetchComments,
} from '../services/reels';


/* -------------------------------------------------------
   HELPERS
------------------------------------------------------- */

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


/* -------------------------------------------------------
   SCREEN
------------------------------------------------------- */

export default function ReelsScreen() {
  const { width, height } = useWindowDimensions();

  const { user } = useAuth();
  const {
    users,
  } = useAppData();

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

  const [commentSheetVisible, setCommentSheetVisible] =
    useState(false);

  const [selectedReel, setSelectedReel] = useState(null);

  const listRef = useRef(null);

  const mountedRef = useRef(true);

  /* Prevent repeated Friends loading */
  const friendsLoadedRef = useRef(false);


  /* -------------------------------------------------------
     MOUNT / UNMOUNT
  ------------------------------------------------------- */

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);


  /* -------------------------------------------------------
     DISCOVER
  ------------------------------------------------------- */

  const loadDiscover = useCallback(
    async (refresh = false) => {
      try {
        if (refresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const result = await fetchShorts(
          refresh ? null : nextPageToken
        );

        if (!mountedRef.current) return;

        const items = Array.isArray(result?.items)
          ? result.items
          : [];

        if (refresh) {
          setDiscoverReels(items);
          setNextPageToken(
            result?.nextPageToken || null
          );
          setActiveIndex(0);
        } else {
          setDiscoverReels((previous) => {
            const oldItems = Array.isArray(previous)
              ? previous
              : [];

            const existingIds = new Set(
              oldItems.map(
                (item) =>
                  item?.videoId || item?.id
              )
            );

            const newItems = items.filter(
              (item) =>
                item &&
                !existingIds.has(
                  item.videoId || item.id
                )
            );

            return [
              ...oldItems,
              ...newItems,
            ];
          });

          setNextPageToken(
            result?.nextPageToken || null
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
        if (!mountedRef.current) return;

        setLoading(false);
        setRefreshing(false);
      }
    },
    [nextPageToken]
  );


  /* -------------------------------------------------------
     FRIEND REELS
  ------------------------------------------------------- */

  const loadFriendReels = useCallback(
    async (forceRefresh = false) => {
      if (!user?.uid) {
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

        const result = await fetchReels(
          user.uid
        );

        if (!mountedRef.current) return;

        /*
         * fetchReels may return:
         *
         * []
         * { reels: [] }
         * { items: [] }
         * { data: [] }
         * { results: [] }
         *
         * Normalize all of them.
         */
        const reels =
          normalizeReelsResult(result);

        setFriendReels(reels);

        friendsLoadedRef.current = true;

        setActiveIndex(0);
      } catch (error) {
        console.error(
          'Friends reels error:',
          error
        );

        if (mountedRef.current) {
          setFriendReels([]);

          Alert.alert(
            'Friends Reels',
            error?.message ||
              'Could not load friend reels.'
          );
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    },
    [user?.uid]
  );


  /* -------------------------------------------------------
     INITIAL DISCOVER LOAD
  ------------------------------------------------------- */

  useEffect(() => {
    loadDiscover(true);
  }, []);


  /* -------------------------------------------------------
     TAB CHANGE
  ------------------------------------------------------- */

  useEffect(() => {
    if (activeTab === 'friends') {
      loadFriendReels();
    }
  }, [
    activeTab,
    loadFriendReels,
  ]);


  /* -------------------------------------------------------
     CURRENT DATA
  ------------------------------------------------------- */

  const data =
    activeTab === 'discover'
      ? Array.isArray(discoverReels)
        ? discoverReels
        : []
      : Array.isArray(friendReels)
        ? friendReels
        : [];


  /* -------------------------------------------------------
     REFRESH
  ------------------------------------------------------- */

  const handleRefresh = useCallback(
    async () => {
      if (activeTab === 'discover') {
        setNextPageToken(null);
        await loadDiscover(true);
      } else {
        friendsLoadedRef.current = false;
        await loadFriendReels(true);
      }
    },
    [
      activeTab,
      loadDiscover,
      loadFriendReels,
    ]
  );


  /* -------------------------------------------------------
     LOAD MORE DISCOVER
  ------------------------------------------------------- */

  const handleLoadMore = useCallback(
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
          await fetchShorts(nextPageToken);

        if (!mountedRef.current) return;

        const items =
          Array.isArray(result?.items)
            ? result.items
            : [];

        setDiscoverReels((previous) => {
          const oldItems =
            Array.isArray(previous)
              ? previous
              : [];

          const existingIds = new Set(
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
        });

        setNextPageToken(
          result?.nextPageToken || null
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
      loadingMore,
      loading,
      nextPageToken,
    ]
  );


  /* -------------------------------------------------------
     VIEWABILITY
  ------------------------------------------------------- */

  const onViewableItemsChanged =
    useRef(
      ({ viewableItems }) => {
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

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 70,
  }).current;


  /* -------------------------------------------------------
     LIKE
  ------------------------------------------------------- */

  const handleLike = async (item) => {
    if (!user?.uid || !item?.id) {
      return;
    }

    try {
      await toggleLikeReel(
        item.id,
        user.uid
      );

      /*
       * Update local state immediately.
       */
      const updateList = (list) =>
        list.map((reel) => {
          if (reel.id !== item.id) {
            return reel;
          }

          const likes = Array.isArray(
            reel.likes
          )
            ? reel.likes
            : [];

          const alreadyLiked =
            likes.includes(user.uid);

          return {
            ...reel,
            likes: alreadyLiked
              ? likes.filter(
                  (id) =>
                    id !== user.uid
                )
              : [
                  ...likes,
                  user.uid,
                ],
          };
        });

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


  /* -------------------------------------------------------
     COMMENTS
  ------------------------------------------------------- */

  const openComments = async (item) => {
    if (!item?.id) {
      return;
    }

    setSelectedReel(item);
    setCommentSheetVisible(true);

    try {
      const result =
        await fetchComments(item.id);

      if (!mountedRef.current) {
        return;
      }

      const loadedComments =
        Array.isArray(result)
          ? result
          : Array.isArray(
              result?.comments
            )
            ? result.comments
            : [];

      setComments(
        loadedComments
      );

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


  const submitComment = async (
    text
  ) => {
    if (
      !user?.uid ||
      !selectedReel?.id ||
      !text?.trim()
    ) {
      return;
    }

    try {
      await addComment(
        selectedReel.id,
        user.uid,
        text.trim()
      );

      const result =
        await fetchComments(
          selectedReel.id
        );

      const loadedComments =
        Array.isArray(result)
          ? result
          : Array.isArray(
              result?.comments
            )
            ? result.comments
            : [];

      if (!mountedRef.current) {
        return;
      }

      setComments(
        loadedComments
      );

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


  const removeComment = async (
    commentId
  ) => {
    if (!commentId) {
      return;
    }

    try {
      await deleteComment(
        commentId
      );

      if (!selectedReel?.id) {
        return;
      }

      const result =
        await fetchComments(
          selectedReel.id
        );

      const loadedComments =
        Array.isArray(result)
          ? result
          : Array.isArray(
              result?.comments
            )
            ? result.comments
            : [];

      if (!mountedRef.current) {
        return;
      }

      setComments(
        loadedComments
      );

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


  /* -------------------------------------------------------
     RENDER FRIEND VIDEO
  ------------------------------------------------------- */

  const renderFriendVideo = (
    item,
    index
  ) => {
    const isActive =
      index === activeIndex;

    const uri =
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
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Video
          source={{ uri }}
          style={{
            width,
            height,
          }}
          resizeMode={ResizeMode.COVER}
          shouldPlay={isActive}
          isLooping
          useNativeControls={false}
        />

        {/* Overlay */}
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


  /* -------------------------------------------------------
     RENDER YOUTUBE
  ------------------------------------------------------- */

  const renderYoutubeVideo = (
    item,
    index
  ) => {
    const isActive =
      index === activeIndex;

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
        />
      );
    }

    /*
     * We do NOT force the whole screen into
     * TikTok/Instagram 9:16.
     *
     * The YouTube player is centered.
     * YouTube controls the actual video content.
     */
    const playerWidth =
      Math.min(
        width,
        720
      );

    const playerHeight =
      Math.round(
        playerWidth * (9 / 16)
      );

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
        <YoutubePlayer
          height={playerHeight}
          width={playerWidth}
          videoId={item.videoId}
          play={isActive}
          mute={false}
          forceAndroidAutoplay
          webViewProps={{
            allowsInlineMediaPlayback: true,
            mediaPlaybackRequiresUserAction: false,
          }}
          onChangeState={(state) => {
            console.log(
              'YouTube state:',
              state
            );
          }}
          onError={(error) => {
            console.log(
              'YouTube error:',
              error
            );
          }}
        />

        {/* YouTube information */}
        <View
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: 30,
          }}
        >
          <View
            style={{
              maxWidth: width * 0.8,
            }}
          >
            <Animated.Text
              numberOfLines={2}
              style={{
                color: '#fff',
                fontSize: 16,
                fontWeight: '700',
              }}
            >
              {item?.title ||
                'YouTube Short'}
            </Animated.Text>

            <Animated.Text
              numberOfLines={1}
              style={{
                color: '#ddd',
                fontSize: 13,
                marginTop: 5,
              }}
            >
              {item?.authorName ||
                item?.channelTitle ||
                'YouTube'}
            </Animated.Text>
          </View>
        </View>
      </View>
    );
  };


  /* -------------------------------------------------------
     RENDER ITEM
  ------------------------------------------------------- */

  const renderItem = ({
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


  /* -------------------------------------------------------
     EMPTY STATE
  ------------------------------------------------------- */

  const renderEmpty = () => {
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
            ? 'No videos available'
            : 'No friend reels yet'}
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
            ? 'Pull down to refresh and try again.'
            : 'Your friends’ uploaded reels will appear here.'}
        </Animated.Text>
      </View>
    );
  };


  /* -------------------------------------------------------
     MAIN UI
  ------------------------------------------------------- */

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#000',
      }}
    >

      {/* -----------------------------------------------
          TOP TABS
      ------------------------------------------------ */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          paddingTop: 45,
          paddingBottom: 12,
        }}
      >
        <Pressable
          onPress={() =>
            setActiveTab('discover')
          }
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
            Discover
          </Animated.Text>
        </Pressable>

        <Pressable
          onPress={() =>
            setActiveTab('friends')
          }
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


      {/* -----------------------------------------------
          REELS LIST
      ------------------------------------------------ */}

      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={(item, index) =>
          String(
            item?.id ||
              item?.videoId ||
              `reel-${index}`
          )
        }
        renderItem={renderItem}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToAlignment="start"
        decelerationRate="fast"
        initialNumToRender={2}
        maxToRenderPerBatch={3}
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
            onRefresh={
              handleRefresh
            }
            tintColor="#fff"
            colors={['#fff']}
          />
        }

        ListEmptyComponent={
          renderEmpty
        }

        ListFooterComponent={
          loadingMore ? (
            <View
              style={{
                height: 80,
                justifyContent:
                  'center',
                alignItems: 'center',
                backgroundColor:
                  '#000',
              }}
            >
              <ActivityIndicator
                color="#fff"
              />
            </View>
          ) : null
        }
      />


      {/* -----------------------------------------------
          COMMENTS SHEET PLACEHOLDER
          Existing comment logic preserved.
      ------------------------------------------------ */}

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
