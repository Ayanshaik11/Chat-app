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
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import YoutubePlayer from 'react-native-youtube-iframe';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../context/AuthContext';

import {
  fetchReels,
  toggleReelLike,
  deleteReel,
  fetchComments,
  addComment,
} from '../services/reels';

import { fetchShorts } from '../services/youtube';

const VIEWABILITY_CONFIG = {
  itemVisiblePercentThreshold: 70,
};

const EMPTY_ARRAY = [];

export default function ReelsScreen() {
  const { user } = useAuth();

  const {
    height: windowHeight,
    width: windowWidth,
  } = useWindowDimensions();

  const reelHeight = windowHeight;
  const playerWidth = windowWidth;
  const playerHeight = windowHeight;

  const listRef = useRef(null);
  const mountedRef = useRef(true);
  const friendsLoadedRef = useRef(false);

  const [activeTab, setActiveTab] =
    useState('discover');

  const [discoverReels, setDiscoverReels] =
    useState([]);

  const [friendReels, setFriendReels] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [loadingMore, setLoadingMore] =
    useState(false);

  const [activeIndex, setActiveIndex] =
    useState(0);

  const [nextPageToken, setNextPageToken] =
    useState(null);

  const [searchText, setSearchText] =
    useState('');

  const [activeSearch, setActiveSearch] =
    useState('');

  const [commentCounts, setCommentCounts] =
    useState({});

  const [comments, setComments] =
    useState([]);

  const [commentSheetVisible, setCommentSheetVisible] =
    useState(false);

  const [selectedReel, setSelectedReel] =
    useState(null);

  const [commentText, setCommentText] =
    useState('');

  const [likeAnimation] =
    useState(() => new Animated.Value(0));

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  /*
   * DISCOVER
   */

  const loadDiscover = useCallback(
    async (
      refresh = false,
      searchOverride = null
    ) => {
      if (!mountedRef.current) {
        return;
      }

      const search =
        searchOverride !== null
          ? searchOverride
          : activeSearch;

      if (refresh) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const result =
          await fetchShorts({
            query: search,
            pageToken:
              refresh
                ? null
                : nextPageToken,
          });

        if (!mountedRef.current) {
          return;
        }

        const items =
          Array.isArray(result?.items)
            ? result.items
            : Array.isArray(result)
              ? result
              : EMPTY_ARRAY;

        const token =
          result?.nextPageToken || null;

        if (refresh) {
          setDiscoverReels(items);
          setNextPageToken(token);

          setActiveIndex(0);

          requestAnimationFrame(() => {
            if (
              mountedRef.current &&
              listRef.current
            ) {
              try {
                listRef.current.scrollToOffset({
                  offset: 0,
                  animated: false,
                });
              } catch (e) {}
            }
          });
        } else {
          setDiscoverReels(
            previous => {
              const existingIds =
                new Set(
                  previous.map(
                    item =>
                      item.videoId ||
                      item.id
                  )
                );

              const newItems =
                items.filter(item => {
                  const id =
                    item.videoId ||
                    item.id;

                  if (!id) {
                    return true;
                  }

                  return !existingIds.has(id);
                });

              return [
                ...previous,
                ...newItems,
              ];
            }
          );

          setNextPageToken(token);
        }
      } catch (error) {
        console.log(
          'loadDiscover error:',
          error
        );

        if (refresh && mountedRef.current) {
          Alert.alert(
            'Reels',
            'Could not load reels right now.'
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
    [
      activeSearch,
      nextPageToken,
    ]
  );

  /*
   * FRIEND REELS
   */

  const loadFriendReels = useCallback(
    async () => {
      if (
        !user?.uid ||
        !mountedRef.current
      ) {
        return;
      }

      setLoading(true);

      try {
        const result =
          await fetchReels(user.uid);

        if (!mountedRef.current) {
          return;
        }

        const items =
          Array.isArray(result)
            ? result
            : EMPTY_ARRAY;

        setFriendReels(items);
        setActiveIndex(0);
        friendsLoadedRef.current = true;
      } catch (error) {
        console.log(
          'loadFriendReels error:',
          error
        );
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    },
    [user?.uid]
  );

  /*
   * INITIAL DISCOVER LOAD
   */

  useEffect(() => {
    let cancelled = false;

    const initialLoad = async () => {
      if (cancelled) {
        return;
      }

      await loadDiscover(
        true,
        ''
      );
    };

    initialLoad();

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * FRIEND TAB
   */

  useEffect(() => {
    if (activeTab !== 'friends') {
      return;
    }

    loadFriendReels();
  }, [
    activeTab,
    loadFriendReels,
  ]);

  /*
   * TAB CHANGE
   */

  const changeTab = useCallback(
    tab => {
      if (tab === activeTab) {
        return;
      }

      setActiveIndex(0);
      setActiveTab(tab);
    },
    [activeTab]
  );

  /*
   * SEARCH
   */

  const performSearch = useCallback(
    async () => {
      const query =
        searchText.trim();

      setActiveSearch(query);
      setNextPageToken(null);
      setActiveIndex(0);

      await loadDiscover(
        true,
        query
      );
    },
    [
      searchText,
      loadDiscover,
    ]
  );

  const clearSearch = useCallback(
    async () => {
      setSearchText('');
      setActiveSearch('');
      setNextPageToken(null);
      setActiveIndex(0);

      await loadDiscover(
        true,
        ''
      );
    },
    [loadDiscover]
  );

  /*
   * REFRESH
   */

  const handleRefresh = useCallback(
    async () => {
      if (refreshing) {
        return;
      }

      setRefreshing(true);
      setNextPageToken(null);
      setActiveIndex(0);

      if (activeTab === 'friends') {
        await loadFriendReels();
      } else {
        await loadDiscover(
          true,
          activeSearch
        );
      }
    },
    [
      refreshing,
      activeTab,
      activeSearch,
      loadDiscover,
      loadFriendReels,
    ]
  );

  /*
   * LOAD MORE
   */

  const handleLoadMore = useCallback(
    async () => {
      if (
        activeTab !== 'discover'
      ) {
        return;
      }

      if (
        loading ||
        loadingMore ||
        !nextPageToken
      ) {
        return;
      }

      await loadDiscover(
        false,
        activeSearch
      );
    },
    [
      activeTab,
      loading,
      loadingMore,
      nextPageToken,
      activeSearch,
      loadDiscover,
    ]
  );

  /*
   * VIEWABILITY
   *
   * Important:
   * no navigation calls here.
   * no autoplay callbacks.
   */

  const onViewableItemsChanged =
    useRef(
      ({ viewableItems }) => {
        if (
          !viewableItems ||
          viewableItems.length === 0
        ) {
          return;
        }

        const first =
          viewableItems[0];

        const index =
          first?.index;

        if (
          index === null ||
          index === undefined
        ) {
          return;
        }

        setActiveIndex(
          previous => {
            if (
              previous === index
            ) {
              return previous;
            }

            return index;
          }
        );
      }
    ).current;

  /*
   * LIKE
   */

  const handleLike = useCallback(
    async item => {
      if (
        !user?.uid ||
        !item?.id
      ) {
        return;
      }

      try {
        await toggleReelLike(
          item.id,
          user.uid
        );

        Animated.sequence([
          Animated.timing(
            likeAnimation,
            {
              toValue: 1,
              duration: 120,
              useNativeDriver: true,
            }
          ),
          Animated.timing(
            likeAnimation,
            {
              toValue: 0,
              duration: 250,
              useNativeDriver: true,
            }
          ),
        ]).start();
      } catch (error) {
        console.log(
          'like error:',
          error
        );
      }
    },
    [
      user?.uid,
      likeAnimation,
    ]
  );

  /*
   * DELETE
   */

  const handleDelete = useCallback(
    item => {
      if (
        !item?.id ||
        !user?.uid
      ) {
        return;
      }

      Alert.alert(
        'Delete reel?',
        'This action cannot be undone.',
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
                await deleteReel(
                  item.id,
                  user.uid
                );

                if (
                  !mountedRef.current
                ) {
                  return;
                }

                setFriendReels(
                  previous =>
                    previous.filter(
                      reel =>
                        reel.id !==
                        item.id
                    )
                );

                setActiveIndex(
                  previous =>
                    Math.max(
                      0,
                      previous - 1
                    )
                );
              } catch (error) {
                console.log(
                  'delete error:',
                  error
                );

                Alert.alert(
                  'Error',
                  'Could not delete reel.'
                );
              }
            },
          },
        ]
      );
    },
    [user?.uid]
  );

  /*
   * COMMENTS
   */

  const openComments =
    useCallback(
      async item => {
        if (!item?.id) {
          return;
        }

        setSelectedReel(item);
        setCommentSheetVisible(true);

        try {
          const result =
            await fetchComments(
              item.id
            );

          if (
            mountedRef.current
          ) {
            setComments(
              Array.isArray(result)
                ? result
                : []
            );
          }
        } catch (error) {
          console.log(
            'comments error:',
            error
          );
        }
      },
      []
    );

  const submitComment =
    useCallback(
      async () => {
        const text =
          commentText.trim();

        if (
          !text ||
          !selectedReel?.id ||
          !user?.uid
        ) {
          return;
        }

        try {
          await addComment(
            selectedReel.id,
            {
              uid: user.uid,
              text,
            }
          );

          setCommentText('');

          const result =
            await fetchComments(
              selectedReel.id
            );

          if (
            mountedRef.current
          ) {
            setComments(
              Array.isArray(result)
                ? result
                : []
            );
          }
        } catch (error) {
          console.log(
            'comment error:',
            error
          );
        }
      },
      [
        commentText,
        selectedReel?.id,
        user?.uid,
      ]
    );

  /*
   * VIDEO
   */

  const renderFriendVideo =
    useCallback(
      (
        item,
        isActive
      ) => {
        /*
         * IMPORTANT:
         * Don't keep native video players
         * alive for every FlatList item.
         */

        if (!isActive) {
          return (
            <View
              style={{
                width: playerWidth,
                height: playerHeight,
                backgroundColor: '#000',
              }}
            />
          );
        }

        return (
          <Video
            source={{
              uri: item.videoURL,
            }}
            style={{
              width: playerWidth,
              height: playerHeight,
              backgroundColor: '#000',
            }}
            resizeMode={
              ResizeMode.COVER
            }
            shouldPlay
            isLooping
            isMuted={false}
            useNativeControls={false}
          />
        );
      },
      [
        playerWidth,
        playerHeight,
      ]
    );

  /*
   * YOUTUBE VIDEO
   *
   * This is the main crash fix.
   *
   * Only ONE YoutubePlayer is mounted.
   * No onReady.
   * No onChangeState.
   * No playVideo().
   * No autoplay timeout.
   */

  const renderYoutubeVideo =
    useCallback(
      (
        item,
        isActive
      ) => {
        if (
          !isActive ||
          !item?.videoId
        ) {
          return (
            <View
              style={{
                width: playerWidth,
                height: playerHeight,
                backgroundColor: '#000',
              }}
            />
          );
        }

        return (
          <View
            style={{
              width: playerWidth,
              height: playerHeight,
              backgroundColor: '#000',
              overflow: 'hidden',
            }}
          >
            <YoutubePlayer
              width={playerWidth}
              height={playerHeight}
              videoId={item.videoId}
              play={true}
              mute={false}
              forceAndroidAutoplay={false}
              webViewProps={{
                allowsInlineMediaPlayback: true,
                mediaPlaybackRequiresUserAction: false,
                javaScriptEnabled: true,
                domStorageEnabled: true,
                androidLayerType: 'hardware',
              }}
              onError={error => {
                console.log(
                  'YouTube error:',
                  error
                );
              }}
            />
          </View>
        );
      },
      [
        playerWidth,
        playerHeight,
      ]
    );

  /*
   * RENDER ITEM
   */

  const renderItem =
    useCallback(
      ({ item, index }) => {
        const isActive =
          index === activeIndex;

        const isExternal =
          item?.isExternal === true ||
          !!item?.videoId;

        return (
          <View
            style={{
              width: playerWidth,
              height: reelHeight,
              backgroundColor: '#000',
            }}
          >
            {isExternal
              ? renderYoutubeVideo(
                  item,
                  isActive
                )
              : renderFriendVideo(
                  item,
                  isActive
                )}

            {/* TOP BAR */}

            <LinearGradient
              colors={[
                'rgba(0,0,0,0.65)',
                'rgba(0,0,0,0)',
              ]}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 120,
              }}
              pointerEvents="none"
            />

            <View
              style={{
                position: 'absolute',
                top: 50,
                left: 16,
                right: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text
                style={{
                  color: '#fff',
                  fontSize: 22,
                  fontWeight: '800',
                }}
              >
                Reels
              </Text>

              <Pressable
                onPress={() => {
                  setSearchText('');
                }}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor:
                    'rgba(0,0,0,0.45)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons
                  name="search"
                  size={23}
                  color="#fff"
                />
              </Pressable>
            </View>

            {/* RIGHT ACTIONS */}

            <View
              style={{
                position: 'absolute',
                right: 14,
                bottom: 125,
                alignItems: 'center',
              }}
            >
              {!isExternal && (
                <>
                  <Pressable
                    onPress={() =>
                      handleLike(item)
                    }
                    style={{
                      marginBottom: 22,
                      alignItems: 'center',
                    }}
                  >
                    <Ionicons
                      name="heart-outline"
                      size={31}
                      color="#fff"
                    />

                    <Text
                      style={{
                        color: '#fff',
                        marginTop: 4,
                        fontSize: 12,
                      }}
                    >
                      Like
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() =>
                      openComments(item)
                    }
                    style={{
                      marginBottom: 22,
                      alignItems: 'center',
                    }}
                  >
                    <Ionicons
                      name="chatbubble-outline"
                      size={29}
                      color="#fff"
                    />

                    <Text
                      style={{
                        color: '#fff',
                        marginTop: 4,
                        fontSize: 12,
                      }}
                    >
                      {commentCounts[
                        item.id
                      ] || 0}
                    </Text>
                  </Pressable>
                </>
              )}

              {!isExternal &&
                item.authorId ===
                  user?.uid && (
                  <Pressable
                    onPress={() =>
                      handleDelete(item)
                    }
                    style={{
                      alignItems: 'center',
                    }}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={27}
                      color="#fff"
                    />
                  </Pressable>
                )}
            </View>

            {/* BOTTOM INFO */}

            <LinearGradient
              colors={[
                'transparent',
                'rgba(0,0,0,0.8)',
              ]}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: 180,
                paddingHorizontal: 16,
                justifyContent: 'flex-end',
                paddingBottom: 30,
              }}
              pointerEvents="none"
            >
              <Text
                style={{
                  color: '#fff',
                  fontSize: 16,
                  fontWeight: '700',
                  marginBottom: 6,
                }}
                numberOfLines={1}
              >
                {item.authorName ||
                  item.channelTitle ||
                  'King X'}
              </Text>

              {!!item.title && (
                <Text
                  style={{
                    color: '#fff',
                    fontSize: 14,
                  }}
                  numberOfLines={2}
                >
                  {item.title}
                </Text>
              )}
            </LinearGradient>
          </View>
        );
      },
      [
        activeIndex,
        playerWidth,
        reelHeight,
        renderYoutubeVideo,
        renderFriendVideo,
        handleLike,
        openComments,
        handleDelete,
        commentCounts,
        user?.uid,
      ]
    );

  /*
   * DATA
   */

  const data =
    activeTab === 'friends'
      ? friendReels
      : discoverReels;

  /*
   * KEY
   */

  const keyExtractor =
    useCallback(
      (item, index) => {
        return String(
          item?.id ||
          item?.videoId ||
          `reel-${index}`
        );
      },
      []
    );

  /*
   * SEARCH UI
   */

  const SearchBar = (
    <View
      style={{
        position: 'absolute',
        top: 95,
        left: 15,
        right: 15,
        zIndex: 20,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor:
          'rgba(20,20,20,0.92)',
        borderRadius: 14,
        paddingHorizontal: 12,
        height: 48,
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
        placeholder="Search reels..."
        placeholderTextColor="#888"
        returnKeyType="search"
        style={{
          flex: 1,
          color: '#fff',
          marginLeft: 8,
          fontSize: 15,
        }}
      />

      {!!searchText && (
        <Pressable
          onPress={clearSearch}
        >
          <Ionicons
            name="close-circle"
            size={20}
            color="#aaa"
          />
        </Pressable>
      )}
    </View>
  );

  /*
   * EMPTY
   */

  if (
    loading &&
    data.length === 0
  ) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#000',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator
          color="#fff"
          size="large"
        />

        <Text
          style={{
            color: '#aaa',
            marginTop: 12,
          }}
        >
          Loading reels...
        </Text>
      </View>
    );
  }

  /*
   * MAIN
   */

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#000',
      }}
    >
      <FlatList
        ref={listRef}
        data={data}
        renderItem={renderItem}
        keyExtractor={keyExtractor}

        extraData={activeIndex}

        pagingEnabled

        showsVerticalScrollIndicator={false}

        decelerationRate="fast"

        snapToAlignment="start"

        viewabilityConfig={
          VIEWABILITY_CONFIG
        }

        onViewableItemsChanged={
          onViewableItemsChanged
        }

        initialNumToRender={1}

        maxToRenderPerBatch={1}

        windowSize={2}

        removeClippedSubviews={false}

        getItemLayout={(
          _data,
          index
        ) => ({
          length: reelHeight,
          offset:
            reelHeight * index,
          index,
        })}

        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={
              handleRefresh
            }
            tintColor="#fff"
          />
        }

        onEndReached={
          handleLoadMore
        }

        onEndReachedThreshold={0.7}

        ListEmptyComponent={
          <View
            style={{
              height: reelHeight,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#000',
            }}
          >
            <Ionicons
              name="film-outline"
              size={55}
              color="#555"
            />

            <Text
              style={{
                color: '#aaa',
                marginTop: 12,
              }}
            >
              No reels found
            </Text>
          </View>
        }
      />

      {/* SEARCH */}

      {activeTab ===
        'discover' &&
        SearchBar}

      {/* TAB SWITCHER */}

      <View
        style={{
          position: 'absolute',
          top: 50,
          left: 0,
          right: 0,
          alignItems: 'center',
          pointerEvents: 'box-none',
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            backgroundColor:
              'rgba(0,0,0,0.45)',
            borderRadius: 22,
            padding: 3,
          }}
        >
          <Pressable
            onPress={() =>
              changeTab(
                'discover'
              )
            }
            style={{
              paddingHorizontal: 15,
              paddingVertical: 8,
              borderRadius: 19,
              backgroundColor:
                activeTab ===
                'discover'
                  ? 'rgba(255,255,255,0.18)'
                  : 'transparent',
            }}
          >
            <Text
              style={{
                color: '#fff',
                fontWeight:
                  activeTab ===
                  'discover'
                    ? '800'
                    : '500',
              }}
            >
              Discover
            </Text>
          </Pressable>

          <Pressable
            onPress={() =>
              changeTab(
                'friends'
              )
            }
            style={{
              paddingHorizontal: 15,
              paddingVertical: 8,
              borderRadius: 19,
              backgroundColor:
                activeTab ===
                'friends'
                  ? 'rgba(255,255,255,0.18)'
                  : 'transparent',
            }}
          >
            <Text
              style={{
                color: '#fff',
                fontWeight:
                  activeTab ===
                  'friends'
                    ? '800'
                    : '500',
              }}
            >
              Friends
            </Text>
          </Pressable>
        </View>
      </View>

      {/* COMMENTS */}

      {commentSheetVisible && (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '55%',
            backgroundColor: '#111',
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            zIndex: 50,
            padding: 18,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent:
                'space-between',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: '#fff',
                fontSize: 19,
                fontWeight: '800',
              }}
            >
              Comments
            </Text>

            <Pressable
              onPress={() =>
                setCommentSheetVisible(
                  false
                )
              }
            >
              <Ionicons
                name="close"
                size={27}
                color="#fff"
              />
            </Pressable>
          </View>

          <FlatList
            data={comments}
            keyExtractor={(
              item,
              index
            ) =>
              String(
                item?.id ||
                index
              )
            }
            style={{
              marginTop: 15,
            }}
            renderItem={({
              item,
            }) => (
              <View
                style={{
                  paddingVertical: 9,
                }}
              >
                <Text
                  style={{
                    color: '#fff',
                    fontWeight: '700',
                  }}
                >
                  {item?.authorName ||
                    item?.username ||
                    'User'}
                </Text>

                <Text
                  style={{
                    color: '#ccc',
                    marginTop: 3,
                  }}
                >
                  {item?.text ||
                    ''}
                </Text>
              </View>
            )}
            ListEmptyComponent={
              <Text
                style={{
                  color: '#777',
                  textAlign: 'center',
                  marginTop: 30,
                }}
              >
                No comments yet.
              </Text>
            }
          />

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: 10,
            }}
          >
            <TextInput
              value={commentText}
              onChangeText={
                setCommentText
              }
              placeholder="Add a comment..."
              placeholderTextColor="#777"
              style={{
                flex: 1,
                height: 45,
                borderRadius: 22,
                backgroundColor:
                  '#222',
                color: '#fff',
                paddingHorizontal: 15,
              }}
            />

            <Pressable
              onPress={
                submitComment
              }
              style={{
                marginLeft: 8,
                width: 45,
                height: 45,
                borderRadius: 23,
                alignItems:
                  'center',
                justifyContent:
                  'center',
                backgroundColor:
                  '#E11D2A',
              }}
            >
              <Ionicons
                name="send"
                size={20}
                color="#fff"
              />
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}