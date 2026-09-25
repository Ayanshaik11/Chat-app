import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  View,
  useWindowDimensions,
} from 'react-native';

import { Video, ResizeMode } from 'expo-av';
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

import {
  fetchDiscoverVideos,
} from '../services/pexels';

import Avatar from '../components/Avatar';
import EmptyState from '../components/EmptyState';
import T from '../components/T';


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
  itemHeight,
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const likes = reel.likes || [];

  const liked =
    !reel.isExternal &&
    likes.includes(meId);

  const like = () => {
    // Pexels videos don't have Firebase likes yet.
    if (reel.isExternal) return;

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

  const openAuthor = () => {
    // Pexels creator
    if (reel.isExternal) {
      if (reel.pexelsUrl) {
        Linking.openURL(reel.pexelsUrl).catch(() => {});
      }
      return;
    }

    // Firebase user
    if (reel.authorId) {
      onOpenAuthor(reel.authorId);
    }
  };

  return (
    <Pressable
      onPress={onToggleMute}
      style={{
        height: itemHeight,
        width: '100%',
        backgroundColor: '#000',
      }}
    >
      <Video
        source={{ uri: reel.videoURL }}
        style={{
          width: '100%',
          height: '100%',
        }}
        resizeMode={ResizeMode.COVER}
        isLooping
        shouldPlay={active}
        isMuted={muted}
      />

      {/* Bottom information */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: 16,
          paddingBottom: 28,
        }}
      >
        <Pressable
          onPress={openAuthor}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginBottom: 8,
          }}
        >
          {reel.isExternal ? (
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: '#111',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons
                name="play"
                size={17}
                color="#fff"
              />
            </View>
          ) : (
            <Avatar
              uri={author?.photoURL}
              name={author?.name}
              size={34}
            />
          )}

          <View>
            <T
              weight="semibold"
              color="#fff"
              size={14}
            >
              {reel.isExternal
                ? reel.authorName || 'Pexels creator'
                : author?.username ||
                  author?.name ||
                  'User'}
            </T>

            {reel.isExternal ? (
              <T
                color="#ddd"
                size={11}
              >
                Pexels
              </T>
            ) : null}
          </View>
        </Pressable>

        {reel.caption ? (
          <T
            color="#fff"
            size={13}
            style={{ maxWidth: '80%' }}
          >
            {reel.caption}
          </T>
        ) : null}

        {/* Pexels attribution */}
        {reel.isExternal ? (
          <Pressable
            onPress={() => {
              if (reel.pexelsUrl) {
                Linking.openURL(reel.pexelsUrl).catch(() => {});
              }
            }}
            style={{ marginTop: 6 }}
          >
            <T
              color="#ddd"
              size={11}
            >
              View on Pexels
            </T>
          </Pressable>
        ) : null}
      </View>

      {/* Right controls */}
      <View
        style={{
          position: 'absolute',
          right: 12,
          bottom: 90,
          alignItems: 'center',
          gap: 22,
        }}
      >
        {/* Like only for user reels */}
        {!reel.isExternal ? (
          <Pressable
            onPress={like}
            hitSlop={10}
            style={{ alignItems: 'center' }}
          >
            <Animated.View
              style={{
                transform: [{ scale }],
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

            <T
              size={12}
              color="#fff"
              style={{ marginTop: 2 }}
            >
              {likes.length}
            </T>
          </Pressable>
        ) : null}

        {/* Mute */}
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

        {/* Delete only user's own reels */}
        {!reel.isExternal &&
        reel.authorId === meId ? (
          <Pressable
            onPress={() => onDelete(reel)}
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
    </Pressable>
  );
}


export default function ReelsScreen({ navigation }) {
  const { me } = useAuth();

  const {
    friendIds,
    friendProfiles,
  } = useAppData();

  const { colors } = useTheme();
  const { vibrate } = useSettings();

  const { height } = useWindowDimensions();

  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [activeIndex, setActiveIndex] =
    useState(0);

  const [muted, setMuted] =
    useState(true);

  const audienceKey = [
    me.id,
    ...friendIds,
  ]
    .sort()
    .join(',');

  const people = {
    [me.id]: me,
    ...friendProfiles,
  };


  /*
   * Load both:
   *
   * 1. User/friend reels from Firebase
   * 2. Internet reels from Pexels
   */
  const load = useCallback(
    async () => {
      try {
        setLoading(true);

        const [
          userReels,
          pexelsReels,
        ] = await Promise.allSettled([
          fetchReels(
            audienceKey.split(',')
          ),
          fetchDiscoverVideos(1, 10),
        ]);

        const firebaseVideos =
          userReels.status === 'fulfilled'
            ? userReels.value
            : [];

        const internetVideos =
          pexelsReels.status === 'fulfilled'
            ? pexelsReels.value
            : [];

        /*
         * Mix the two feeds.
         *
         * Example:
         * User → Pexels → User → Pexels...
         */
        const mixed = [];

        const max = Math.max(
          firebaseVideos.length,
          internetVideos.length
        );

        for (let i = 0; i < max; i++) {
          if (firebaseVideos[i]) {
            mixed.push(firebaseVideos[i]);
          }

          if (internetVideos[i]) {
            mixed.push(internetVideos[i]);
          }
        }

        setReels(mixed);
        setActiveIndex(0);
      } catch (e) {
        console.warn(
          'reels load failed',
          e
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [audienceKey]
  );


  useFocusEffect(
    useCallback(() => {
      load();

      return () =>
        setActiveIndex(-1);
    }, [load])
  );


  const onViewableItemsChanged =
    useRef(
      ({ viewableItems }) => {
        if (viewableItems.length) {
          setActiveIndex(
            viewableItems[0].index ?? 0
          );
        }
      }
    ).current;


  const viewabilityConfig =
    useRef({
      itemVisiblePercentThreshold: 70,
    }).current;


  /*
   * Firebase Reel like
   */
  const onLike = (reel) => {
    if (reel.isExternal) return;

    const liked =
      (reel.likes || []).includes(
        me.id
      );

    setReels((rs) =>
      rs.map((r) =>
        r.id === reel.id
          ? {
              ...r,
              likes: liked
                ? r.likes.filter(
                    (x) => x !== me.id
                  )
                : [
                    ...(r.likes || []),
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
    ).catch(() => load());
  };


  /*
   * Delete Firebase Reel
   */
  const onDelete = (reel) =>
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

          onPress: async () => {
            setReels((rs) =>
              rs.filter(
                (r) =>
                  r.id !== reel.id
              )
            );

            await deleteReel(
              reel
            ).catch(() => {});
          },
        },
      ]
    );


  if (loading) {
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
          color={colors.primary}
        />

        <T
          color="#fff"
          size={13}
          style={{ marginTop: 10 }}
        >
          Loading reels...
        </T>
      </View>
    );
  }


  if (!reels.length) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <EmptyState
          icon="videocam-outline"
          title="No reels yet"
          text="Add friends or check your internet connection to discover reels."
          actionLabel="Create a reel"
          onAction={() =>
            navigation.navigate(
              'Create',
              { mode: 'reel' }
            )
          }
        />
      </View>
    );
  }


  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#000',
      }}
    >
      <FlatList
        data={reels}

        keyExtractor={(r) =>
          r.id
        }

        pagingEnabled

        showsVerticalScrollIndicator={
          false
        }

        snapToInterval={height}

        decelerationRate="fast"

        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor="#fff"
          />
        }

        onViewableItemsChanged={
          onViewableItemsChanged
        }

        viewabilityConfig={
          viewabilityConfig
        }

        getItemLayout={(_, i) => ({
          length: height,
          offset: height * i,
          index: i,
        })}

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

            itemHeight={height}

            active={
              index ===
              activeIndex
            }

            muted={muted}

            onToggleMute={() =>
              setMuted(
                (m) => !m
              )
            }

            onLike={onLike}

            onDelete={onDelete}

            onOpenAuthor={(
              uid
            ) =>
              uid === me.id
                ? navigation.navigate(
                    'Profile'
                  )
                : navigation.navigate(
                    'UserProfile',
                    {
                      userId: uid,
                    }
                  )
            }
          />
        )}
      />

      {/* Create user reel */}
      <Pressable
        onPress={() =>
          navigation.navigate(
            'Create',
            { mode: 'reel' }
          )
        }
        style={{
          position: 'absolute',
          top: 50,
          right: 16,
        }}
      >
        <Ionicons
          name="add-circle"
          size={32}
          color="#fff"
        />
      </Pressable>
    </View>
  );
}