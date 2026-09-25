import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';

import { auth } from '../config/firebase';
import {
  fetchReels,
  toggleReelLike,
  deleteReel,
} from '../services/reels';

const ReelItem = ({
  reel,
  index,
  activeIndex,
  meId,
  height,
  onLike,
  onDelete,
}) => {
  const videoRef = useRef(null);

  const [muted, setMuted] = useState(false);
  const [liked, setLiked] = useState(
    Array.isArray(reel.likes) && reel.likes.includes(meId)
  );

  const isActive = index === activeIndex;

  useEffect(() => {
    setLiked(
      Array.isArray(reel.likes) && reel.likes.includes(meId)
    );
  }, [reel.likes, meId]);

  useEffect(() => {
    if (!videoRef.current) return;

    if (isActive) {
      videoRef.current.playAsync().catch(() => {});
    } else {
      videoRef.current.pauseAsync().catch(() => {});
    }
  }, [isActive]);

  const handleLike = async () => {
    if (!meId) return;

    const nextLiked = !liked;

    setLiked(nextLiked);

    try {
      await onLike(reel.id, nextLiked);
    } catch (error) {
      setLiked(!nextLiked);

      Alert.alert(
        'Like failed',
        'Could not update the like. Please try again.'
      );
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete reel?',
      'This video will be permanently deleted.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete(reel),
        },
      ]
    );
  };

  const likeCount = Array.isArray(reel.likes)
    ? reel.likes.length
    : 0;

  return (
    <View
      style={{
        height,
        width: '100%',
        backgroundColor: '#000',
      }}
    >
      <Pressable
        style={{
          flex: 1,
        }}
        onPress={() => {
          setMuted((value) => !value);
        }}
      >
        <Video
          ref={videoRef}
          source={{
            uri: reel.videoURL,
          }}
          style={{
            width: '100%',
            height: '100%',
          }}
          resizeMode={ResizeMode.COVER}
          shouldPlay={isActive}
          isLooping
          isMuted={muted}
          useNativeControls={false}
        />

        {/* Bottom gradient-like dark overlay */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 260,
            backgroundColor: 'rgba(0,0,0,0.20)',
          }}
        />

        {/* Mute indicator */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 45,
            right: 20,
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: 'rgba(0,0,0,0.45)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons
            name={muted ? 'volume-mute' : 'volume-high'}
            size={21}
            color="#fff"
          />
        </View>

        {/* Right-side buttons */}
        <View
          style={{
            position: 'absolute',
            right: 14,
            bottom: 115,
            alignItems: 'center',
          }}
        >
          {/* Like */}
          <Pressable
            onPress={handleLike}
            style={{
              alignItems: 'center',
              marginBottom: 22,
            }}
          >
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={34}
              color={liked ? '#ff3040' : '#fff'}
            />

            <Animated.Text
              style={{
                color: '#fff',
                fontSize: 13,
                marginTop: 3,
                fontWeight: '600',
              }}
            >
              {likeCount}
            </Animated.Text>
          </Pressable>

          {/* Delete own reel */}
          {reel.authorId === meId && (
            <Pressable
              onPress={handleDelete}
              style={{
                alignItems: 'center',
              }}
            >
              <Ionicons
                name="trash-outline"
                size={30}
                color="#fff"
              />
            </Pressable>
          )}
        </View>

        {/* Bottom information */}
        <View
          style={{
            position: 'absolute',
            left: 16,
            right: 75,
            bottom: 30,
          }}
        >
          {/* Username */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 9,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: '#111',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.4)',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 9,
              }}
            >
              <Ionicons
                name="person"
                size={18}
                color="#fff"
              />
            </View>

            <Animated.Text
              numberOfLines={1}
              style={{
                color: '#fff',
                fontSize: 16,
                fontWeight: '700',
                flexShrink: 1,
              }}
            >
              {reel.authorName || 'King X user'}
            </Animated.Text>
          </View>

          {/* Caption */}
          {!!reel.caption && (
            <Animated.Text
              numberOfLines={3}
              style={{
                color: '#fff',
                fontSize: 14,
                lineHeight: 20,
              }}
            >
              {reel.caption}
            </Animated.Text>
          )}
        </View>
      </Pressable>
    </View>
  );
};

export default function ReelsScreen() {
  const { height } = useWindowDimensions();

  const [reels, setReels] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const meId = auth.currentUser?.uid || null;

  /*
   * Load only King X user reels.
   * Pexels has been completely removed.
   */
  const load = useCallback(
    async (refresh = false) => {
      if (!meId) {
        setReels([]);
        setLoading(false);
        return;
      }

      try {
        if (refresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        /*
         * For now we load reels from the users
         * available to the current audience.
         *
         * Replace audienceKey with your existing
         * audience logic if your app has one.
         */
        const audienceKey = meId;

        const userReels = await fetchReels(
          audienceKey.split(',')
        );

        setReels(userReels);
        setActiveIndex(0);
      } catch (error) {
        console.warn('Reels load error:', error);

        Alert.alert(
          'Could not load reels',
          'Please check your internet connection and try again.'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [meId]
  );

  useEffect(() => {
    load();
  }, [load]);

  const onLike = useCallback(
    async (reelId, nextLiked) => {
      if (!meId) return;

      await toggleReelLike(
        reelId,
        meId,
        !nextLiked
      );

      setReels((current) =>
        current.map((reel) => {
          if (reel.id !== reelId) return reel;

          const likes = Array.isArray(reel.likes)
            ? [...reel.likes]
            : [];

          if (nextLiked) {
            if (!likes.includes(meId)) {
              likes.push(meId);
            }
          } else {
            const index = likes.indexOf(meId);

            if (index !== -1) {
              likes.splice(index, 1);
            }
          }

          return {
            ...reel,
            likes,
          };
        })
      );
    },
    [meId]
  );

  const onDelete = useCallback(
    async (reel) => {
      try {
        await deleteReel(reel);

        setReels((current) =>
          current.filter(
            (item) => item.id !== reel.id
          )
        );
      } catch (error) {
        console.warn('Delete reel error:', error);

        Alert.alert(
          'Delete failed',
          'Could not delete this reel.'
        );
      }
    },
    []
  );

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80,
  }).current;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }) => {
      if (!viewableItems?.length) return;

      const firstVisible = viewableItems[0];

      if (
        typeof firstVisible.index === 'number'
      ) {
        setActiveIndex(firstVisible.index);
      }
    }
  ).current;

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
          size="large"
          color="#fff"
        />
      </View>
    );
  }

  if (!reels.length) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#000',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 30,
        }}
      >
        <Ionicons
          name="videocam-outline"
          size={60}
          color="#fff"
        />

        <Animated.Text
          style={{
            color: '#fff',
            fontSize: 20,
            fontWeight: '700',
            marginTop: 15,
          }}
        >
          No reels yet
        </Animated.Text>

        <Animated.Text
          style={{
            color: '#aaa',
            fontSize: 14,
            textAlign: 'center',
            marginTop: 8,
          }}
        >
          Upload a reel to start your King X feed.
        </Animated.Text>

        <Pressable
          onPress={() => load(true)}
          style={{
            marginTop: 20,
            paddingHorizontal: 22,
            paddingVertical: 12,
            borderRadius: 25,
            backgroundColor: '#fff',
          }}
        >
          <Animated.Text
            style={{
              color: '#000',
              fontWeight: '700',
            }}
          >
            Refresh
          </Animated.Text>
        </Pressable>
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
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <ReelItem
            reel={item}
            index={index}
            activeIndex={activeIndex}
            meId={meId}
            height={height}
            onLike={onLike}
            onDelete={onDelete}
          />
        )}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        snapToAlignment="start"
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={
          onViewableItemsChanged
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor="#fff"
          />
        }
        initialNumToRender={2}
        maxToRenderPerBatch={3}
        windowSize={5}
        removeClippedSubviews
      />
    </View>
  );
}