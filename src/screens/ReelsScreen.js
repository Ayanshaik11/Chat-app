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
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { Video, ResizeMode } from 'expo-av';
import YoutubePlayer from 'react-native-youtube-iframe';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import { useSettings, useTheme } from '../context/SettingsContext';

import {
  deleteReel,
  fetchReels,
  toggleReelLike,
} from '../services/reels';

import { fetchShorts } from '../services/youtube';

import {
  addReelComment,
  deleteReelComment,
  getReelCommentCount,
  subscribeReelComments,
} from '../services/reelComments';

import { timeAgo } from '../utils/helpers';
import Avatar from '../components/Avatar';
import EmptyState from '../components/EmptyState';
import T from '../components/T';


/* =========================================================
   REEL ITEM
========================================================= */

function ReelItem({
  reel,
  author,
  meId,
  active,
  muted,
  onToggleMute,
  onLike,
  onDelete,
  onOpenAuthor,
  onOpenComments,
  itemHeight,
}) {
  const { width } = useWindowDimensions();

  const scale = useRef(
    new Animated.Value(1)
  ).current;

  const likes = reel.likes || [];

  const liked = likes.includes(meId);

  /*
   * YouTube reels are external.
   * They cannot be liked/commented on
   * inside our Firebase system.
   */
  const canLike = !reel.isExternal;

  const [commentCount, setCommentCount] =
    useState(null);


  /* =======================================================
     COMMENT COUNT
  ======================================================== */

  useEffect(() => {
    let alive = true;

    if (!reel.isExternal) {
      getReelCommentCount(reel.id)
        .then((n) => {
          if (alive) {
            setCommentCount(n);
          }
        })
        .catch(() => {});
    }

    return () => {
      alive = false;
    };
  }, [
    reel.id,
    reel.isExternal,
  ]);


  /* =======================================================
     LIKE
  ======================================================== */

  const like = () => {
    if (!canLike) return;

    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.4,
        duration: 110,
        useNativeDriver: true,
      }),

      Animated.timing(scale, {
        toValue: 1,
        duration: 110,
        useNativeDriver: true,
      }),
    ]).start();

    onLike(reel);
  };


  /* =======================================================
     YOUTUBE THUMBNAIL
  ======================================================== */

  const youtubeThumbnail =
    reel.thumbnail ||
    reel.thumbnailUrl ||
    (
      reel.videoId
        ? `https://i.ytimg.com/vi/${reel.videoId}/hqdefault.jpg`
        : null
    );


  return (
    <View
      style={{
        width,
        height: itemHeight,
        backgroundColor: '#000',
        overflow: 'hidden',
      }}
    >

      {/* =====================================================
          YOUTUBE DISCOVER REEL
      ====================================================== */}

      {reel.isExternal ? (

        active ? (

          /*
           * IMPORTANT:
           *
           * Do NOT use justifyContent:'center' here.
           * The YouTube player should occupy the whole
           * Reel container.
           */
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width,
              height: itemHeight,
              backgroundColor: '#000',
              overflow: 'hidden',
            }}
          >

            <YoutubePlayer
              height={itemHeight}
              width={width}
              videoId={reel.videoId}

              /* Playback */

              play={true}

              mute={muted}

              forceAndroidAutoplay={true}


              /* YouTube player */

              initialPlayerParams={{
                controls: false,
                modestbranding: true,
                rel: false,
                playsinline: true,
              }}


              /* Android WebView */

              webViewProps={{
                androidLayerType: 'hardware',

                mediaPlaybackRequiresUserAction:
                  false,

                allowsFullscreenVideo:
                  false,

                allowsInlineMediaPlayback:
                  true,

                javaScriptEnabled:
                  true,

                domStorageEnabled:
                  true,

                mixedContentMode:
                  'always',
              }}


              /* WebView background */

              webViewStyle={{
                backgroundColor: '#000',
              }}
            />

          </View>

        ) : (

          /*
           * Do not create YouTube WebViews
           * for every reel.
           *
           * This improves scrolling performance.
           */
          <Pressable
            onPress={onToggleMute}
            style={{
              width,
              height: itemHeight,
              backgroundColor: '#000',
            }}
          >

            {youtubeThumbnail ? (

              <Image
                source={{
                  uri: youtubeThumbnail,
                }}
                style={{
                  width: '100%',
                  height: '100%',
                }}
                resizeMode="cover"
              />

            ) : (

              <View
                style={{
                  flex: 1,
                  backgroundColor: '#000',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >

                <Ionicons
                  name="logo-youtube"
                  size={60}
                  color="#FF0000"
                />

              </View>

            )}

          </Pressable>

        )

      ) : (

        /* ===================================================
           FRIEND REEL
        ==================================================== */

        <Pressable
          onPress={onToggleMute}
          style={{
            width,
            height: itemHeight,
            backgroundColor: '#000',
          }}
        >

          <Video
            source={{
              uri: reel.videoURL,
            }}

            style={{
              width: '100%',
              height: '100%',
            }}

            resizeMode={
              ResizeMode.COVER
            }

            isLooping

            shouldPlay={active}

            isMuted={muted}
          />

        </Pressable>

      )}


      {/* =====================================================
          BOTTOM INFORMATION
      ====================================================== */}

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,

          padding: 16,
          paddingBottom: 28,

          zIndex: 3,
        }}

        pointerEvents="box-none"
      >

        {reel.isExternal ? (

          <Pressable
            onPress={() => {
              if (reel.youtubeUrl) {
                Linking.openURL(
                  reel.youtubeUrl
                );
              }
            }}

            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginBottom: 8,
            }}
          >

            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,

                backgroundColor:
                  '#1a1a1a',

                alignItems: 'center',
                justifyContent: 'center',
              }}
            >

              <Ionicons
                name="logo-youtube"
                size={18}
                color="#FF0000"
              />

            </View>


            <T
              weight="semibold"
              color="#fff"
              size={14}
              numberOfLines={1}
              style={{
                maxWidth: '75%',
              }}
            >
              {reel.authorName ||
                reel.channelTitle ||
                'YouTube'}
            </T>

          </Pressable>

        ) : (

          <Pressable
            onPress={() =>
              onOpenAuthor(
                reel.authorId
              )
            }

            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginBottom: 8,
            }}
          >

            <Avatar
              uri={author?.photoURL}
              name={author?.name}
              size={34}
            />

            <T
              weight="semibold"
              color="#fff"
              size={14}
            >
              {author?.username ||
                author?.name ||
                'User'}
            </T>

          </Pressable>

        )}


        {/* Caption / title */}

        {(reel.caption ||
          reel.title ||
          reel.description) ? (

          <T
            color="#fff"
            size={13}
            numberOfLines={2}
            style={{
              maxWidth: '80%',
            }}
          >
            {reel.caption ||
              reel.title ||
              reel.description}
          </T>

        ) : null}

      </View>


      {/* =====================================================
          RIGHT SIDE BUTTONS
      ====================================================== */}

      <View
        style={{
          position: 'absolute',

          right: 12,
          bottom: 90,

          alignItems: 'center',

          gap: 22,

          zIndex: 4,
        }}
      >

        {/* ===================================================
            LIKE
        ==================================================== */}

        <Pressable
          onPress={like}
          hitSlop={10}

          style={{
            alignItems: 'center',
            opacity:
              canLike ? 1 : 0.5,
          }}
        >

          <Animated.View
            style={{
              transform: [
                {
                  scale,
                },
              ],
            }}
          >

            <Ionicons
              name={
                liked
                  ? 'heart'
                  : 'heart-outline'
              }

              size={32}

              color={
                liked
                  ? '#F43F5E'
                  : '#fff'
              }
            />

          </Animated.View>


          {canLike ? (

            <T
              size={12}
              color="#fff"
              style={{
                marginTop: 2,
              }}
            >
              {likes.length}
            </T>

          ) : null}

        </Pressable>


        {/* ===================================================
            COMMENTS
        ==================================================== */}

        {!reel.isExternal ? (

          <Pressable
            onPress={() =>
              onOpenComments(reel)
            }

            hitSlop={10}

            style={{
              alignItems: 'center',
            }}
          >

            <Ionicons
              name="chatbubble-outline"
              size={28}
              color="#fff"
            />


            {commentCount ? (

              <T
                size={12}
                color="#fff"
                style={{
                  marginTop: 2,
                }}
              >
                {commentCount}
              </T>

            ) : null}

          </Pressable>

        ) : null}


        {/* ===================================================
            MUTE
        ==================================================== */}

        <Pressable
          onPress={onToggleMute}
          hitSlop={10}
        >

          <Ionicons
            name={
              muted
                ? 'volume-mute'
                : 'volume-high'
            }

            size={26}
            color="#fff"
          />

        </Pressable>


        {/* ===================================================
            DELETE
        ==================================================== */}

        {!reel.isExternal &&
        reel.authorId === meId ? (

          <Pressable
            onPress={() =>
              onDelete(reel)
            }

            hitSlop={10}
          >

            <Ionicons
              name="trash-outline"
              size={24}
              color="#fff"
            />

          </Pressable>

        ) : null}

      </View>

    </View>
  );
}


/* =========================================================
   TAB PILL
========================================================= */

function TabPill({
  label,
  active,
  onPress,
}) {
  return (
    <Pressable
      onPress={onPress}

      style={{
        paddingHorizontal: 16,
        paddingVertical: 6,

        borderRadius: 16,

        backgroundColor:
          active
            ? 'rgba(255,255,255,0.95)'
            : 'rgba(255,255,255,0.15)',
      }}
    >

      <T
        weight="semibold"
        size={13}
        color={
          active
            ? '#111'
            : '#fff'
        }
      >
        {label}
      </T>

    </Pressable>
  );
}


/* =========================================================
   COMMENTS SHEET
========================================================= */

function ReelCommentsSheet({
  reel,
  meId,
  onClose,
}) {
  const { colors, fonts } =
    useTheme();

  const [comments, setComments] =
    useState([]);

  const [text, setText] =
    useState('');

  const [sending, setSending] =
    useState(false);


  /* =======================================================
     COMMENTS SUBSCRIPTION
  ======================================================== */

  useEffect(
    () =>
      reel
        ? subscribeReelComments(
            reel.id,
            setComments
          )
        : undefined,

    [reel?.id]
  );


  /* =======================================================
     SEND COMMENT
  ======================================================== */

  const send = async () => {
    const t = text.trim();

    if (!t || !reel) {
      return;
    }

    setText('');
    setSending(true);

    try {
      await addReelComment(
        reel.id,
        {
          id: meId,
        },
        t
      );

    } catch (e) {

      setText(t);

      Alert.alert(
        'Comment not sent',
        e.message
      );

    } finally {

      setSending(false);

    }
  };


  /* =======================================================
     DELETE COMMENT
  ======================================================== */

  const remove = (c) =>
    Alert.alert(
      'Delete comment?',
      undefined,

      [
        {
          text: 'Cancel',
          style: 'cancel',
        },

        {
          text: 'Delete',
          style: 'destructive',

          onPress: () =>
            deleteReelComment(
              reel.id,
              c.id
            ).catch(() => {}),
        },
      ]
    );


  return (
    <Modal
      visible={!!reel}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >

      <Pressable
        style={{
          flex: 1,
          backgroundColor:
            'rgba(0,0,0,0.5)',
        }}

        onPress={onClose}
      />


      <KeyboardAvoidingView
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >

        <View
          style={{
            height: '65%',

            backgroundColor:
              colors.bg,

            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,

            overflow: 'hidden',
          }}
        >

          {/* Handle */}

          <View
            style={{
              alignItems: 'center',
              paddingVertical: 10,
            }}
          >

            <View
              style={{
                width: 40,
                height: 4,

                borderRadius: 2,

                backgroundColor:
                  colors.border,
              }}
            />

          </View>


          <T
            weight="semibold"
            size={15}

            style={{
              textAlign: 'center',
              marginBottom: 8,
            }}
          >
            Comments
          </T>


          {/* =================================================
              COMMENTS LIST
          ================================================== */}

          <FlatList
            data={comments}

            keyExtractor={(c) =>
              c.id
            }

            keyboardShouldPersistTaps="handled"

            contentContainerStyle={{
              paddingBottom: 8,
            }}

            renderItem={({
              item,
            }) => (

              <View
                style={{
                  flexDirection: 'row',
                  gap: 10,

                  paddingHorizontal: 16,
                  paddingVertical: 8,
                }}
              >

                <Avatar
                  uri={item.authorPhoto}
                  name={item.authorName}
                  size={30}
                />


                <View
                  style={{
                    flex: 1,
                  }}
                >

                  <T size={14}>

                    <T
                      weight="semibold"
                      size={14}
                    >
                      {item.authorName}{' '}
                    </T>

                    {item.text}

                  </T>


                  <T
                    size={11}
                    color="subtext"

                    style={{
                      marginTop: 2,
                    }}
                  >
                    {timeAgo(
                      item.createdAt
                    )}
                  </T>

                </View>


                {(item.authorId === meId ||
                  reel?.authorId === meId) ? (

                  <Pressable
                    onPress={() =>
                      remove(item)
                    }

                    hitSlop={10}
                  >

                    <Ionicons
                      name="trash-outline"
                      size={16}
                      color={
                        colors.subtext
                      }
                    />

                  </Pressable>

                ) : null}

              </View>
            )}


            ListEmptyComponent={

              <T
                color="subtext"

                style={{
                  textAlign: 'center',
                  paddingVertical: 20,
                }}
              >
                No comments yet — be the first!
              </T>

            }
          />


          {/* =================================================
              COMMENT INPUT
          ================================================== */}

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',

              padding: 10,

              gap: 8,

              borderTopWidth: 1,

              borderTopColor:
                colors.border,
            }}
          >

            <TextInput
              value={text}

              onChangeText={
                setText
              }

              placeholder="Add a comment…"

              placeholderTextColor={
                colors.subtext
              }

              style={{
                flex: 1,

                height: 40,

                backgroundColor:
                  colors.inputBg,

                borderRadius: 20,

                paddingHorizontal: 16,

                fontFamily:
                  fonts.regular,

                fontSize: 14,

                color: colors.text,
              }}
            />


            <Pressable
              onPress={send}

              disabled={
                !text.trim() ||
                sending
              }

              hitSlop={10}

              style={{
                opacity:
                  text.trim()
                    ? 1
                    : 0.4,
              }}
            >

              <T
                weight="semibold"
                size={14}
                color="primary"
              >
                Post
              </T>

            </Pressable>

          </View>

        </View>

      </KeyboardAvoidingView>

    </Modal>
  );
}


/* =========================================================
   REELS SCREEN
========================================================= */

export default function ReelsScreen({
  navigation,
}) {
  const { me } = useAuth();

  const {
    friendIds,
    friendProfiles,
  } = useAppData();

  const { colors } =
    useTheme();

  const { vibrate } =
    useSettings();

  const { height } =
    useWindowDimensions();


  /* =======================================================
     LIST REF
  ======================================================== */

  const listRef =
    useRef(null);


  /* =======================================================
     STATE
  ======================================================== */

  const [tab, setTab] =
    useState('discover');

  const [friendReels, setFriendReels] =
    useState([]);

  const [discoverReels, setDiscoverReels] =
    useState([]);

  const [discoverPageToken, setDiscoverPageToken] =
    useState(null);

  const [loadingMore, setLoadingMore] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [activeIndex, setActiveIndex] =
    useState(0);

  const [muted, setMuted] =
    useState(true);

  const [commentsReel, setCommentsReel] =
    useState(null);


  /* =======================================================
     AUDIENCE
  ======================================================== */

  const audienceKey =
    [me.id, ...friendIds]
      .sort()
      .join(',');


  const people = {
    [me.id]: me,
    ...friendProfiles,
  };


  /* =======================================================
     CURRENT REELS
  ======================================================== */

  const reels =
    tab === 'discover'
      ? discoverReels
      : friendReels;


  /* =======================================================
     FRIEND REELS
  ======================================================== */

  const loadFriends =
    useCallback(async () => {

      try {

        const data =
          await fetchReels(
            audienceKey.split(',')
          );

        setFriendReels(
          data
        );

      } catch (e) {

        console.warn(
          'reels load failed',
          e
        );

      }

    }, [audienceKey]);


  /* =======================================================
     YOUTUBE DISCOVER
  ======================================================== */

  const loadDiscover =
    useCallback(
      async (
        pageToken = null,
        append = false
      ) => {

        try {

          const {
            items,
            nextPageToken,
          } = await fetchShorts(
            pageToken
          );


          setDiscoverReels(
            (prev) =>
              append
                ? [
                    ...prev,
                    ...items,
                  ]
                : items
          );


          setDiscoverPageToken(
            nextPageToken
          );

        } catch (e) {

          console.error(
            'YouTube Discover error:',
            e
          );


          if (!append) {

            Alert.alert(
              'Could not load Discover',

              e?.message ||
                'Could not load videos right now. Try again shortly.'
            );

          }

        }

      },
      []
    );


  /* =======================================================
     SCREEN FOCUS
  ======================================================== */

  useFocusEffect(
    useCallback(() => {

      setLoading(true);

      const jobs = [
        loadFriends(),
      ];


      if (!discoverReels.length) {
        jobs.push(
          loadDiscover(null)
        );
      }


      Promise.all(jobs)
        .finally(() => {
          setLoading(false);
        });


      return () => {

        /*
         * Stop YouTube player when
         * leaving the screen.
         */
        setActiveIndex(-1);

      };

    }, [
      loadFriends,
      loadDiscover,
      discoverReels.length,
    ])
  );


  /* =======================================================
     LOAD MORE
  ======================================================== */

  const onEndReached =
    useCallback(() => {

      if (
        tab !== 'discover' ||
        loadingMore ||
        !discoverPageToken
      ) {
        return;
      }


      setLoadingMore(true);


      loadDiscover(
        discoverPageToken,
        true
      ).finally(() => {

        setLoadingMore(false);

      });

    }, [
      tab,
      loadingMore,
      discoverPageToken,
      loadDiscover,
    ]);


  /* =======================================================
     REFRESH
  ======================================================== */

  const onRefresh =
    useCallback(() => {

      setRefreshing(true);


      const job =
        tab === 'discover'
          ? loadDiscover(null)
          : loadFriends();


      job.finally(() => {

        setRefreshing(false);

      });

    }, [
      tab,
      loadDiscover,
      loadFriends,
    ]);


  /* =======================================================
     VIEWABILITY
  ======================================================== */

  const onViewableItemsChanged =
    useRef(
      ({
        viewableItems,
      }) => {

        if (!viewableItems?.length) {
          return;
        }


        /*
         * Choose the most visible item.
         *
         * This prevents the active player from
         * changing randomly while swiping.
         */

        const sorted =
          [...viewableItems].sort(
            (a, b) =>
              (b.percentVisible || 0) -
              (a.percentVisible || 0)
          );


        const index =
          sorted[0]?.index;


        if (
          typeof index === 'number'
        ) {

          setActiveIndex(
            index
          );

        }

      }
    ).current;


  const viewabilityConfig =
    useRef({
      itemVisiblePercentThreshold: 85,
    }).current;


  /* =======================================================
     LIKE
  ======================================================== */

  const onLike = useCallback(
    (reel) => {

      const liked =
        (reel.likes || [])
          .includes(me.id);


      setFriendReels(
        (rs) =>
          rs.map((r) =>
            r.id === reel.id
              ? {
                  ...r,

                  likes: liked
                    ? r.likes.filter(
                        (x) =>
                          x !== me.id
                      )
                    : [
                        ...(r.likes ||
                          []),
                        me.id,
                      ],
                }
              : r
          )
      );


      if (!liked) {
        vibrate(15);
      }


      toggleReelLike(
        reel.id,
        me.id,
        liked
      ).catch(() => {
        loadFriends();
      });

    },

    [
      me.id,
      vibrate,
      loadFriends,
    ]
  );


  /* =======================================================
     DELETE
  ======================================================== */

  const onDelete =
    useCallback(
      (reel) => {

        Alert.alert(
          'Delete reel?',

          'This cannot be undone.',

          [
            {
              text: 'Cancel',
              style: 'cancel',
            },

            {
              text: 'Delete',

              style: 'destructive',

              onPress:
                async () => {

                  setFriendReels(
                    (rs) =>
                      rs.filter(
                        (r) =>
                          r.id !==
                          reel.id
                      )
                  );


                  await deleteReel(
                    reel
                  ).catch(() => {});

                },
            },
          ]
        );

      },

      []
    );


  /* =======================================================
     TAB CHANGE
  ======================================================== */

  const changeTab =
    useCallback(
      (nextTab) => {

        setActiveIndex(0);

        setTab(nextTab);


        /*
         * Start from the first reel
         * whenever switching tabs.
         */

        requestAnimationFrame(() => {

          listRef.current?.scrollToOffset({
            offset: 0,
            animated: false,
          });

        });

      },
      []
    );


  /* =======================================================
     HEADER
  ======================================================== */

  const header = (

    <View
      style={{
        position: 'absolute',

        top: 50,
        left: 16,
        right: 16,

        flexDirection: 'row',

        justifyContent:
          'space-between',

        zIndex: 10,

        elevation: 10,
      }}
    >

      <View
        style={{
          flexDirection: 'row',
          gap: 8,
        }}
      >

        <TabPill
          label="Discover"

          active={
            tab === 'discover'
          }

          onPress={() =>
            changeTab(
              'discover'
            )
          }
        />


        <TabPill
          label="Friends"

          active={
            tab === 'friends'
          }

          onPress={() =>
            changeTab(
              'friends'
            )
          }
        />

      </View>


      <Pressable
        onPress={() =>
          navigation.navigate(
            'Create',
            {
              mode: 'reel',
            }
          )
        }

        hitSlop={10}
      >

        <Ionicons
          name="add-circle"
          size={32}
          color="#fff"
        />

      </Pressable>

    </View>
  );


  /* =======================================================
     LOADING
  ======================================================== */

  if (loading) {

    return (

      <View
        style={{
          flex: 1,

          backgroundColor:
            '#000',

          alignItems: 'center',
          justifyContent: 'center',
        }}
      >

        <ActivityIndicator
          color={
            colors.primary
          }
        />

      </View>

    );

  }


  /* =======================================================
     SCREEN
  ======================================================== */

  return (

    <View
      style={{
        flex: 1,
        backgroundColor: '#000',
      }}
    >

      {header}


      {/* ===================================================
          EMPTY STATE
      ==================================================== */}

      {!reels.length ? (

        <View
          style={{
            flex: 1,

            alignItems: 'center',
            justifyContent:
              'center',
          }}
        >

          <EmptyState
            icon="videocam-outline"

            title={
              tab === 'discover'
                ? 'Nothing to discover yet'
                : 'No reels from friends yet'
            }

            text={
              tab === 'discover'
                ? 'Pull down to try again.'
                : 'Share a short video, or add friends to see theirs here.'
            }

            actionLabel={
              tab === 'friends'
                ? 'Create a reel'
                : undefined
            }

            onAction={() =>
              navigation.navigate(
                'Create',
                {
                  mode: 'reel',
                }
              )
            }
          />

        </View>

      ) : (

        /* =================================================
           REELS LIST
        ================================================== */

        <FlatList
          key={tab}

          ref={listRef}

          data={reels}

          keyExtractor={(
            item,
            index
          ) =>
            item.id ||
            item.videoId ||
            `reel-${index}`
          }


          /* =================================================
             ONE REEL PER SWIPE
          ================================================== */

          pagingEnabled

          snapToInterval={
            height
          }

          snapToAlignment="start"

          disableIntervalMomentum={
            true
          }

          decelerationRate="fast"


          /* =================================================
             PERFORMANCE
          ================================================== */

          removeClippedSubviews={
            false
          }

          windowSize={3}

          initialNumToRender={2}

          maxToRenderPerBatch={2}

          updateCellsBatchingPeriod={
            50
          }


          /* =================================================
             DISPLAY
          ================================================== */

          showsVerticalScrollIndicator={
            false
          }

          bounces={false}


          /* =================================================
             VIEWABILITY
          ================================================== */

          onViewableItemsChanged={
            onViewableItemsChanged
          }

          viewabilityConfig={
            viewabilityConfig
          }


          /* =================================================
             ITEM SIZE
          ================================================== */

          getItemLayout={(
            _,
            index
          ) => ({
            length: height,
            offset:
              height * index,
            index,
          })}


          /* =================================================
             PAGINATION
          ================================================== */

          onEndReachedThreshold={
            0.5
          }

          onEndReached={
            onEndReached
          }


          /* =================================================
             PULL TO REFRESH
          ================================================== */

          refreshControl={

            <RefreshControl
              refreshing={
                refreshing
              }

              onRefresh={
                onRefresh
              }

              tintColor="#fff"
            />

          }


          /* =================================================
             RENDER REEL
          ================================================= */

          renderItem={({
            item,
            index,
          }) => (

            <ReelItem
              reel={item}

              author={
                people[
                  item.authorId
                ]
              }

              meId={me.id}

              itemHeight={
                height
              }

              active={
                index ===
                activeIndex
              }

              muted={
                muted
              }

              onToggleMute={() =>
                setMuted(
                  (m) => !m
                )
              }

              onLike={
                onLike
              }

              onDelete={
                onDelete
              }

              onOpenComments={
                setCommentsReel
              }

              onOpenAuthor={(
                uid
              ) => {

                if (
                  uid === me.id
                ) {

                  navigation.navigate(
                    'Profile'
                  );

                } else {

                  navigation.navigate(
                    'UserProfile',
                    {
                      userId: uid,
                    }
                  );

                }

              }}

            />

          )}

        />

      )}


      {/* =====================================================
          COMMENTS
      ====================================================== */}

      <ReelCommentsSheet
        reel={commentsReel}

        meId={me.id}

        onClose={() =>
          setCommentsReel(
            null
          )
        }
      />

    </View>
  );
}