import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
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
import { fetchYouTubeVideos } from '../services/youtube';

const YOUTUBE_BATCH_SIZE = 50;

function shuffle(array) {
  const result = [...array];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

/*
 * Inserts one King X reel after a random
 * 12–15 YouTube videos.
 */
function mixVideos(youtubeVideos, kingVideos) {
  const output = [];
  let kingIndex = 0;
  let youtubeIndex = 0;

  while (youtubeIndex < youtubeVideos.length) {
    const gap = 12 + Math.floor(Math.random() * 4);

    for (
      let i = 0;
      i < gap && youtubeIndex < youtubeVideos.length;
      i++
    ) {
      output.push(youtubeVideos[youtubeIndex]);
      youtubeIndex++;
    }

    if (kingIndex < kingVideos.length) {
      output.push(kingVideos[kingIndex]);
      kingIndex++;
    }
  }

  // If King X videos remain, add them at the end.
  while (kingIndex < kingVideos.length) {
    output.push(kingVideos[kingIndex]);
    kingIndex++;
  }

  return output;
}

function ReelItem({
  reel,
  index,
  activeIndex,
  meId,
  height,
  onLike,
  onDelete,
}) {
  const videoRef = useRef(null);
  const [muted, setMuted] = useState(false);

  const isYouTube = reel.isYouTube === true;
  const isActive = index === activeIndex;

  const liked =
    Array.isArray(reel.likes) &&
    reel.likes.includes(meId);

  const likeCount = Array.isArray(reel.likes)
    ? reel.likes.length
    : 0;

  useEffect(() => {
    if (!videoRef.current || isYouTube) return;

    if (isActive) {
      videoRef.current.playAsync().catch(() => {});
    } else {
      videoRef.current.pauseAsync().catch(() => {});
    }
  }, [isActive, isYouTube]);

  const handleLike = async () => {
    if (!meId || isYouTube) return;

    try {
      await onLike(reel.id, !liked);
    } catch {
      Alert.alert(
        'Like failed',
        'Could not update the like.'
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

  return (
    <View
      style={{
        width: '100%',
        height,
        backgroundColor: '#000',
      }}
    >
      {/*
       * IMPORTANT:
       * YouTube videos are NOT loaded through expo-av.
       *
       * We show the YouTube video placeholder here until
       * a YouTube-compatible player is added.
       */}
      {isYouTube ? (
        <View
          style={{
            flex: 1,
            backgroundColor: '#111',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons
            name="logo-youtube"
            size={70}
            color="#ff0000"
          />

          <Text
            style={{
              color: '#fff',
              fontSize: 17,
              fontWeight: '700',
              marginTop: 15,
              textAlign: 'center',
              paddingHorizontal: 30,
            }}
          >
            {reel.title || 'YouTube video'}
          </Text>

          <Text
            style={{
              color: '#aaa',
              marginTop: 8,
            }}
          >
            {reel.channelTitle || 'YouTube'}
          </Text>

          <Text
            style={{
              color: '#888',
              marginTop: 15,
              fontSize: 12,
            }}
          >
            YouTube player will be used here
          </Text>
        </View>
      ) : (
        <Pressable
          style={{ flex: 1 }}
          onPress={() => setMuted((value) => !value)}
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
              name={
                muted
                  ? 'volume-mute'
                  : 'volume-high'
              }
              size={21}
              color="#fff"
            />
          </View>
        </Pressable>
      )}

      {/* Right side controls */}
      <View
        style={{
          position: 'absolute',
          right: 14,
          bottom: 115,
          alignItems: 'center',
        }}
      >
        {!isYouTube && (
          <>
            <Pressable
              onPress={handleLike}
              style={{
                alignItems: 'center',
                marginBottom: 22,
              }}
            >
              <Ionicons
                name={
                  liked
                    ? 'heart'
                    : 'heart-outline'
                }
                size={34}
                color={
                  liked ? '#ff3040' : '#fff'
                }
              />

              <Text
                style={{
                  color: '#fff',
                  fontSize: 13,
                  marginTop: 3,
                  fontWeight: '600',
                }}
              >
                {likeCount}
              </Text>
            </Pressable>

            {reel.authorId === meId && (
              <Pressable onPress={handleDelete}>
                <Ionicons
                  name="trash-outline"
                  size={30}
                  color="#fff"
                />
              </Pressable>
            )}
          </>
        )}
      </View>

      {/* Bottom information */}
      <View
        style={{
          position: 'absolute',
          left: 16,
          right: 70,
          bottom: 30,
        }}
      >
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
              backgroundColor: isYouTube
                ? '#ff0000'
                : '#111',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 9,
            }}
          >
            <Ionicons
              name={
                isYouTube
                  ? 'logo-youtube'
                  : 'person'
              }
              size={18}
              color="#fff"
            />
          </View>

          <Text
            numberOfLines={1}
            style={{
              color: '#fff',
              fontSize: 16,
              fontWeight: '700',
              flexShrink: 1,
            }}
          >
            {isYouTube
              ? reel.channelTitle
              : reel.authorName || 'King X user'}
          </Text>
        </View>

        {!!(reel.caption || reel.title) && (
          <Text
            numberOfLines={3}
            style={{
              color: '#fff',
              fontSize: 14,
              lineHeight: 20,
            }}
          >
            {reel.caption || reel.title}
          </Text>
        )}
      </View>
    </View>
  );
}

export default function ReelsScreen() {
  const { height } = useWindowDimensions();

  const [reels, setReels] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const meId = auth.currentUser?.uid || null;

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
         * King X user videos
         */
        const kingVideos = await fetchReels(
          [meId]
        );

        /*
         * YouTube public videos
         */
        const youtubeResult =
          await fetchYouTubeVideos({
            limit: YOUTUBE_BATCH_SIZE,
          });

        const youtubeVideos =
          youtubeResult.videos || [];

        /*
         * Shuffle YouTube results so the feed
         * doesn't always have the same order.
         */
        const shuffledYouTube =
          shuffle(youtubeVideos);

        /*
         * 12–15 YouTube videos,
         * then 1 King X video.
         */
        const mixed = mixVideos(
          shuffledYouTube,
          kingVideos
        );

        setReels(mixed);
        setActiveIndex(0);
      } catch (error) {
        console.warn(
          'Reels load error:',
          error
        );

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
          if (reel.id !== reelId) {
            return reel;
          }

          const likes = Array.isArray(
            reel.likes
          )
            ? [...reel.likes]
            : [];

          if (nextLiked) {
            if (!likes.includes(meId)) {
              likes.push(meId);
            }
          } else {
            const index =
              likes.indexOf(meId);

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
        console.warn(
          'Delete reel error:',
          error
        );

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

  const onViewableItemsChanged =
    useRef(({ viewableItems }) => {
      if (!viewableItems?.length) return;

      const item = viewableItems[0];

      if (typeof item.index === 'number') {
        setActiveIndex(item.index);
      }
    }).current;

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

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#000',
      }}
    >
      <FlatList
        data={reels}
        keyExtractor={(item, index) =>
          `${item.id}-${index}`
        }
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