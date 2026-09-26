// src/screens/ReelsScreen.js

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
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
  toggleReelLike,
  deleteReel,
  addReelComment,
  deleteReelComment,
  getReelCommentCount,
  subscribeReelComments,
} from '../services/reels';

import Avatar from '../components/Avatar';
import EmptyState from '../components/EmptyState';


// ============================================================
// HELPERS
// ============================================================

const timeAgo = (date) => {
  if (!date) return '';

  const now = Date.now();
  const then = new Date(date).getTime();

  if (Number.isNaN(then)) return '';

  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;

  return new Date(date).toLocaleDateString();
};


// ============================================================
// SCREEN
// ============================================================

export default function ReelsScreen({ navigation }) {
  const { width, height } = useWindowDimensions();

  const { user } = useAuth();

  useAppData();

  const [activeTab, setActiveTab] = useState('discover');

  const [discoverReels, setDiscoverReels] = useState([]);
  const [friendReels, setFriendReels] = useState([]);

  const [loading, setLoading] = useState(true);
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


  // ==========================================================
  // LOAD YOUTUBE
  // ==========================================================

  const loadDiscover = useCallback(
    async (refresh = false) => {
      try {
        if (refresh) {
          setRefreshing(true);
        } else if (!discoverReels.length) {
          setLoading(true);
        }

        const token = refresh ? null : nextPageToken;

        const result = await fetchShorts(token);

        if (!mountedRef.current) return;

        const newItems = result?.items || [];

        setDiscoverReels((previous) => {
          if (refresh) {
            return newItems;
          }

          const existingIds = new Set(
            previous.map((item) => item.videoId)
          );

          const filtered = newItems.filter(
            (item) => !existingIds.has(item.videoId)
          );

          return [...previous, ...filtered];
        });

        setNextPageToken(
          result?.nextPageToken || null
        );

        if (refresh) {
          setActiveIndex(0);

          requestAnimationFrame(() => {
            listRef.current?.scrollToOffset({
              offset: 0,
              animated: false,
            });
          });
        }
      } catch (error) {
        console.error(
          'Discover load error:',
          error
        );

        if (mountedRef.current) {
          Alert.alert(
            'Could not load Reels',
            error?.message ||
              'Something went wrong.'
          );
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [nextPageToken, discoverReels.length]
  );


  // ==========================================================
  // LOAD FRIEND REELS
  // ==========================================================

  const loadFriendReels = useCallback(
    async (refresh = false) => {
      try {
        if (refresh) {
          setRefreshing(true);
        } else if (!friendReels.length) {
          setLoading(true);
        }

        const result =
          await fetchReels(user?.uid);

        if (!mountedRef.current) return;

        setFriendReels(result || []);

        setActiveIndex(0);

        requestAnimationFrame(() => {
          listRef.current?.scrollToOffset({
            offset: 0,
            animated: false,
          });
        });
      } catch (error) {
        console.error(
          'Friend reels error:',
          error
        );

        if (mountedRef.current) {
          Alert.alert(
            'Could not load Reels',
            error?.message ||
              'Something went wrong.'
          );
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [user?.uid, friendReels.length]
  );


  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {
    mountedRef.current = true;

    loadDiscover();

    return () => {
      mountedRef.current = false;
    };
  }, []);


  // ==========================================================
  // TAB CHANGE
  // ==========================================================

  useEffect(() => {
    setActiveIndex(0);

    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({
        offset: 0,
        animated: false,
      });
    });

    if (
      activeTab === 'friends' &&
      !friendReels.length
    ) {
      loadFriendReels();
    }
  }, [activeTab]);


  // ==========================================================
  // REFRESH
  // ==========================================================

  const onRefresh = useCallback(() => {
    if (activeTab === 'discover') {
      setNextPageToken(null);
      loadDiscover(true);
    } else {
      loadFriendReels(true);
    }
  }, [
    activeTab,
    loadDiscover,
    loadFriendReels,
  ]);


  // ==========================================================
  // LOAD MORE
  // ==========================================================

  const loadMore = useCallback(async () => {
    if (
      activeTab !== 'discover' ||
      loadingMore ||
      !nextPageToken
    ) {
      return;
    }

    setLoadingMore(true);

    await loadDiscover(false);
  }, [
    activeTab,
    loadingMore,
    nextPageToken,
    loadDiscover,
  ]);


  // ==========================================================
  // VIEWABLE ITEM
  // ==========================================================

  const onViewableItemsChanged = useRef(
    ({ viewableItems }) => {
      const first = viewableItems?.[0];

      if (first?.index != null) {
        setActiveIndex(first.index);
      }
    }
  ).current;


  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 85,
  }).current;


  // ==========================================================
  // LIKE
  // ==========================================================

  const handleLike = async (item) => {
    if (item?.isExternal) return;

    try {
      await toggleReelLike(
        item.id,
        user?.uid
      );
    } catch (error) {
      console.error(
        'Like error:',
        error
      );
    }
  };


  // ==========================================================
  // DELETE
  // ==========================================================

  const handleDelete = (item) => {
    if (item?.isExternal) return;

    Alert.alert(
      'Delete Reel',
      'Are you sure you want to delete this Reel?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',

          onPress: async () => {
            try {
              await deleteReel(item.id);

              setFriendReels(
                (previous) =>
                  previous.filter(
                    (reel) =>
                      reel.id !== item.id
                  )
              );
            } catch (error) {
              Alert.alert(
                'Error',
                error?.message ||
                  'Could not delete Reel.'
              );
            }
          },
        },
      ]
    );
  };


  // ==========================================================
  // COMMENTS
  // ==========================================================

  const openComments = async (item) => {
    setSelectedReel(item);
    setCommentSheetVisible(true);

    try {
      const count =
        await getReelCommentCount(
          item.id
        );

      setCommentCounts(
        (previous) => ({
          ...previous,
          [item.id]: count || 0,
        })
      );
    } catch (error) {
      console.error(error);
    }
  };


  // ==========================================================
  // COMMENTS SUBSCRIPTION
  // ==========================================================

  useEffect(() => {
    if (!selectedReel?.id) return;

    const unsubscribe =
      subscribeReelComments(
        selectedReel.id,
        (newComments) => {
          setComments(
            newComments || []
          );
        }
      );

    return () => {
      if (
        typeof unsubscribe ===
        'function'
      ) {
        unsubscribe();
      }
    };
  }, [selectedReel?.id]);


  // ==========================================================
  // ADD COMMENT
  // ==========================================================

  const submitComment = async (text) => {
    if (
      !selectedReel?.id ||
      !text?.trim()
    ) {
      return;
    }

    try {
      await addReelComment(
        selectedReel.id,
        user?.uid,
        text.trim()
      );
    } catch (error) {
      Alert.alert(
        'Error',
        error?.message ||
          'Could not add comment.'
      );
    }
  };


  // ==========================================================
  // DELETE COMMENT
  // ==========================================================

  const removeComment = async (
    comment
  ) => {
    try {
      await deleteReelComment(
        selectedReel.id,
        comment.id
      );
    } catch (error) {
      Alert.alert(
        'Error',
        error?.message ||
          'Could not delete comment.'
      );
    }
  };


  // ==========================================================
  // YOUTUBE REEL
  // ==========================================================

  const renderYouTubeReel = ({
    item,
    index,
  }) => {
    const isActive =
      index === activeIndex;

    /*
     * YouTube's player itself is a normal video player.
     *
     * We DON'T force it to fill the entire phone height.
     *
     * A 16:9 player frame is used as the safe/default
     * YouTube display frame and is centered on the screen.
     *
     * The video is NOT stretched to 9:16.
     */
    const playerWidth = width;

    const playerHeight = Math.round(
      width * (9 / 16)
    );

    return (
      <View
        style={[
          styles.reel,
          {
            width,
            height,
          },
        ]}
      >

        {/* ==================================================
            CENTERED YOUTUBE VIDEO
            ================================================== */}

        <View
          style={[
            styles.videoContainer,
            {
              width,
              height,
            },
          ]}
        >

          <View
            style={[
              styles.youtubeCenter,
              {
                width: playerWidth,
                height: playerHeight,
              },
            ]}
          >

            {isActive ? (
              <YoutubePlayer
                width={playerWidth}
                height={playerHeight}

                videoId={item.videoId}

                /*
                 * Only the currently visible Reel
                 * is allowed to autoplay.
                 */
                play={isActive}

                /*
                 * Request sound.
                 *
                 * YouTube/Android may still block
                 * autoplay-with-sound in some situations.
                 */
                mute={false}

                initialPlayerParams={{
                  controls: false,
                  modestbranding: true,
                  rel: false,
                  playsinline: true,
                  fs: false,
                }}

                webViewProps={{
                  allowsInlineMediaPlayback: true,
                  mediaPlaybackRequiresUserAction: false,
                }}
              />
            ) : (
              <Image
                source={{
                  uri:
                    item.thumbnail ||
                    item.thumbnailUrl,
                }}
                style={[
                  styles.youtubePreview,
                  {
                    width: playerWidth,
                    height: playerHeight,
                  },
                ]}
                resizeMode="contain"
              />
            )}

          </View>

        </View>


        {/* ==================================================
            BOTTOM SHADE
            ================================================== */}

        <View
          pointerEvents="none"
          style={styles.bottomShade}
        />


        {/* ==================================================
            TOP
            ================================================== */}

        <View style={styles.topBar}>

          <Text style={styles.topTitle}>
            Discover
          </Text>

          <Pressable
            style={styles.topButton}
            onPress={() => {}}
          >
            <Ionicons
              name="search"
              size={25}
              color="#fff"
            />
          </Pressable>

        </View>


        {/* ==================================================
            RIGHT ACTIONS
            ================================================== */}

        <View style={styles.actions}>

          {!item.isExternal && (
            <Pressable
              style={styles.actionButton}
              onPress={() =>
                handleLike(item)
              }
            >
              <Ionicons
                name={
                  item.likes?.includes?.(
                    user?.uid
                  )
                    ? 'heart'
                    : 'heart-outline'
                }
                size={34}
                color={
                  item.likes?.includes?.(
                    user?.uid
                  )
                    ? '#ff1744'
                    : '#fff'
                }
              />

              <Text
                style={styles.actionText}
              >
                {item.likes?.length || 0}
              </Text>
            </Pressable>
          )}


          <Pressable
            style={styles.actionButton}
            onPress={() =>
              openComments(item)
            }
          >
            <Ionicons
              name="chatbubble-outline"
              size={32}
              color="#fff"
            />

            <Text
              style={styles.actionText}
            >
              {commentCounts[item.id] ||
                0}
            </Text>
          </Pressable>


          <Pressable
            style={styles.actionButton}
            onPress={() => {
              Alert.alert(
                'YouTube',
                'Open this Reel from the YouTube player.'
              );
            }}
          >
            <Ionicons
              name="logo-youtube"
              size={34}
              color="#fff"
            />

            <Text
              style={styles.actionText}
            >
              YouTube
            </Text>
          </Pressable>


          {!item.isExternal && (
            <Pressable
              style={styles.actionButton}
              onPress={() =>
                handleDelete(item)
              }
            >
              <Ionicons
                name="trash-outline"
                size={30}
                color="#fff"
              />
            </Pressable>
          )}

        </View>


        {/* ==================================================
            BOTTOM INFO
            ================================================== */}

        <View style={styles.info}>

          <View style={styles.authorRow}>

            <Avatar
              uri={item.authorAvatar}
              size={42}
            />

            <Text
              style={styles.authorName}
              numberOfLines={1}
            >
              {item.authorName ||
                item.channelTitle ||
                'YouTube'}
            </Text>

          </View>


          <Text
            style={styles.caption}
            numberOfLines={4}
          >
            {item.caption ||
              item.title ||
              item.description ||
              'YouTube Short'}
          </Text>


          {item.publishedAt && (
            <Text
              style={styles.time}
            >
              {timeAgo(
                item.publishedAt
              )}
            </Text>
          )}

        </View>

      </View>
    );
  };


  // ==========================================================
  // FRIEND REEL
  // ==========================================================

  const renderFriendReel = ({
    item,
    index,
  }) => {
    const isActive =
      index === activeIndex;

    return (
      <View
        style={[
          styles.reel,
          {
            width,
            height,
          },
        ]}
      >

        {/* ==================================================
            FULL SCREEN FRIEND VIDEO
            ================================================== */}

        <View
          style={[
            styles.friendVideoContainer,
            {
              width,
              height,
            },
          ]}
        >

          {isActive ? (
            <Video
              source={{
                uri:
                  item.videoUrl ||
                  item.url,
              }}

              style={{
                width,
                height,
              }}

              resizeMode={
                ResizeMode.COVER
              }

              shouldPlay

              isLooping

              useNativeControls={false}
            />
          ) : (
            <Image
              source={{
                uri:
                  item.thumbnail ||
                  item.thumbnailUrl,
              }}
              style={{
                width,
                height,
              }}
              resizeMode="cover"
            />
          )}

        </View>


        {/* SHADE */}

        <View
          pointerEvents="none"
          style={styles.bottomShade}
        />


        {/* TOP */}

        <View style={styles.topBar}>

          <Text style={styles.topTitle}>
            Friends
          </Text>

        </View>


        {/* ACTIONS */}

        <View style={styles.actions}>

          <Pressable
            style={styles.actionButton}
            onPress={() =>
              handleLike(item)
            }
          >
            <Ionicons
              name={
                item.likes?.includes?.(
                  user?.uid
                )
                  ? 'heart'
                  : 'heart-outline'
              }
              size={34}
              color={
                item.likes?.includes?.(
                  user?.uid
                )
                  ? '#ff1744'
                  : '#fff'
              }
            />

            <Text
              style={styles.actionText}
            >
              {item.likes?.length || 0}
            </Text>
          </Pressable>


          <Pressable
            style={styles.actionButton}
            onPress={() =>
              openComments(item)
            }
          >
            <Ionicons
              name="chatbubble-outline"
              size={32}
              color="#fff"
            />

            <Text
              style={styles.actionText}
            >
              {commentCounts[item.id] ||
                0}
            </Text>
          </Pressable>


          <Pressable
            style={styles.actionButton}
            onPress={() =>
              handleDelete(item)
            }
          >
            <Ionicons
              name="trash-outline"
              size={30}
              color="#fff"
            />
          </Pressable>

        </View>


        {/* INFO */}

        <View style={styles.info}>

          <View style={styles.authorRow}>

            <Avatar
              uri={item.authorAvatar}
              size={42}
            />

            <Text
              style={styles.authorName}
              numberOfLines={1}
            >
              {item.authorName ||
                item.username ||
                'Friend'}
            </Text>

          </View>


          {!!item.caption && (
            <Text
              style={styles.caption}
              numberOfLines={4}
            >
              {item.caption}
            </Text>
          )}


          {item.createdAt && (
            <Text
              style={styles.time}
            >
              {timeAgo(
                item.createdAt
              )}
            </Text>
          )}

        </View>

      </View>
    );
  };


  // ==========================================================
  // CURRENT DATA
  // ==========================================================

  const data =
    activeTab === 'discover'
      ? discoverReels
      : friendReels;


  // ==========================================================
  // LOADING
  // ==========================================================

  if (
    loading &&
    !data.length
  ) {
    return (
      <View style={styles.loading}>

        <ActivityIndicator
          size="large"
          color="#fff"
        />

        <Text
          style={styles.loadingText}
        >
          Loading Reels...
        </Text>

      </View>
    );
  }


  // ==========================================================
  // EMPTY
  // ==========================================================

  if (!data.length) {
    return (
      <View style={styles.container}>

        <View style={styles.tabs}>

          <Pressable
            onPress={() =>
              setActiveTab(
                'discover'
              )
            }

            style={[
              styles.tab,
              activeTab ===
                'discover' &&
                styles.activeTab,
            ]}
          >
            <Text
              style={styles.tabText}
            >
              Discover
            </Text>
          </Pressable>


          <Pressable
            onPress={() =>
              setActiveTab(
                'friends'
              )
            }

            style={[
              styles.tab,
              activeTab ===
                'friends' &&
                styles.activeTab,
            ]}
          >
            <Text
              style={styles.tabText}
            >
              Friends
            </Text>
          </Pressable>

        </View>


        <EmptyState
          title={
            activeTab ===
            'discover'
              ? 'No Reels found'
              : 'No friend Reels yet'
          }

          message={
            activeTab ===
            'discover'
              ? 'Try refreshing.'
              : 'Your friends have not uploaded any Reels yet.'
          }
        />

      </View>
    );
  }


  // ==========================================================
  // MAIN
  // ==========================================================

  return (
    <View style={styles.container}>

      {/* TAB SWITCHER */}

      <View style={styles.tabs}>

        <Pressable
          onPress={() =>
            setActiveTab(
              'discover'
            )
          }

          style={[
            styles.tab,
            activeTab ===
              'discover' &&
              styles.activeTab,
          ]}
        >
          <Text
            style={styles.tabText}
          >
            Discover
          </Text>
        </Pressable>


        <Pressable
          onPress={() =>
            setActiveTab(
              'friends'
            )
          }

          style={[
            styles.tab,
            activeTab ===
              'friends' &&
              styles.activeTab,
          ]}
        >
          <Text
            style={styles.tabText}
          >
            Friends
          </Text>
        </Pressable>

      </View>


      {/* FULL SCREEN VERTICAL REELS */}

      <FlatList
        ref={listRef}

        data={data}

        keyExtractor={(
          item,
          index
        ) =>
          item.id ||
          item.videoId ||
          `${activeTab}-${index}`
        }

        renderItem={
          activeTab ===
          'discover'
            ? renderYouTubeReel
            : renderFriendReel
        }

        extraData={activeIndex}

        horizontal={false}

        showsVerticalScrollIndicator={
          false
        }

        pagingEnabled

        snapToInterval={height}

        snapToAlignment="start"

        decelerationRate="fast"

        disableIntervalMomentum

        bounces={false}

        overScrollMode="never"

        getItemLayout={(
          _,
          index
        ) => ({
          length: height,
          offset:
            height * index,
          index,
        })}

        viewabilityConfig={
          viewabilityConfig
        }

        onViewableItemsChanged={
          onViewableItemsChanged
        }

        onEndReached={
          loadMore
        }

        onEndReachedThreshold={0.5}

        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#fff"
            colors={['#fff']}
          />
        }

        windowSize={3}

        initialNumToRender={1}

        maxToRenderPerBatch={1}

        updateCellsBatchingPeriod={50}

        removeClippedSubviews={
          false
        }
      />


      {/* LOAD MORE */}

      {loadingMore && (
        <View
          style={
            styles.loadingMore
          }
        >
          <ActivityIndicator
            color="#fff"
            size="small"
          />
        </View>
      )}

    </View>
  );
}


// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: '#000',
  },


  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },


  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 15,
  },


  reel: {
    backgroundColor: '#000',
    overflow: 'hidden',
  },


  // ==========================================================
  // YOUTUBE VIDEO
  // ==========================================================

  videoContainer: {
    position: 'absolute',

    top: 0,
    left: 0,
    right: 0,
    bottom: 0,

    backgroundColor: '#000',

    alignItems: 'center',
    justifyContent: 'center',

    overflow: 'hidden',
  },


  youtubeCenter: {
    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: '#000',

    overflow: 'hidden',
  },


  youtubePreview: {
    backgroundColor: '#000',
  },


  // ==========================================================
  // FRIEND VIDEO
  // ==========================================================

  friendVideoContainer: {
    position: 'absolute',

    top: 0,
    left: 0,
    right: 0,
    bottom: 0,

    backgroundColor: '#000',

    alignItems: 'center',
    justifyContent: 'center',
  },


  // ==========================================================
  // OVERLAYS
  // ==========================================================

  bottomShade: {
    position: 'absolute',

    left: 0,
    right: 0,
    bottom: 0,

    height: 280,

    backgroundColor:
      'rgba(0,0,0,0.35)',
  },


  // ==========================================================
  // TOP BAR
  // ==========================================================

  topBar: {
    position: 'absolute',

    top: 45,
    left: 0,
    right: 0,

    height: 55,

    paddingHorizontal: 18,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent:
      'space-between',

    zIndex: 20,
  },


  topTitle: {
    color: '#fff',

    fontSize: 21,

    fontWeight: '700',
  },


  topButton: {
    width: 44,
    height: 44,

    borderRadius: 22,

    alignItems: 'center',
    justifyContent: 'center',
  },


  // ==========================================================
  // ACTIONS
  // ==========================================================

  actions: {
    position: 'absolute',

    right: 12,
    bottom: 115,

    alignItems: 'center',

    zIndex: 30,
  },


  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',

    marginBottom: 22,

    minWidth: 50,
  },


  actionText: {
    color: '#fff',

    fontSize: 12,

    marginTop: 4,

    fontWeight: '600',
  },


  // ==========================================================
  // INFO
  // ==========================================================

  info: {
    position: 'absolute',

    left: 16,
    right: 85,
    bottom: 25,

    zIndex: 30,
  },


  authorRow: {
    flexDirection: 'row',

    alignItems: 'center',

    marginBottom: 10,
  },


  authorName: {
    color: '#fff',

    fontSize: 16,

    fontWeight: '700',

    marginLeft: 10,

    flex: 1,
  },


  caption: {
    color: '#fff',

    fontSize: 14,

    lineHeight: 20,

    fontWeight: '500',
  },


  time: {
    color:
      'rgba(255,255,255,0.7)',

    fontSize: 12,

    marginTop: 7,
  },


  // ==========================================================
  // TABS
  // ==========================================================

  tabs: {
    position: 'absolute',

    top: 45,
    left: 0,
    right: 0,

    height: 50,

    zIndex: 100,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    gap: 8,
  },


  tab: {
    paddingHorizontal: 18,
    paddingVertical: 8,

    borderRadius: 20,

    backgroundColor:
      'rgba(0,0,0,0.45)',
  },


  activeTab: {
    backgroundColor:
      'rgba(255,255,255,0.18)',
  },


  tabText: {
    color: '#fff',

    fontSize: 14,

    fontWeight: '700',
  },


  // ==========================================================
  // LOAD MORE
  // ==========================================================

  loadingMore: {
    position: 'absolute',

    bottom: 25,

    alignSelf: 'center',

    padding: 10,

    borderRadius: 20,

    backgroundColor:
      'rgba(0,0,0,0.6)',
  },

});
