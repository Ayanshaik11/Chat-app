import React, { useEffect, useRef, useState } from 'react';
import { Animated, FlatList, Image, Pressable, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/SettingsContext';
import { subscribeComments } from '../services/comments';
import { timeAgo } from '../utils/helpers';
import { useMusic } from '../utils/useMusic';
import Avatar from './Avatar';
import T from './T';

// one mute switch for every post song in the app
let songMuted = false;
const muteListeners = new Set();
const toggleMuted = () => { songMuted = !songMuted; muteListeners.forEach((f) => f(songMuted)); };
const useMuted = () => {
  const [m, setM] = useState(songMuted);
  useEffect(() => { muteListeners.add(setM); return () => muteListeners.delete(setM); }, []);
  return m;
};

export default function PostCard({
  post,
  author,
  meId,
  onLike,
  onDelete,
  onOpenAuthor,
  onComment,
  active, // true = this post is on screen. undefined = the screen doesn't say, so tap the song to play
}) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();

  const scale = useRef(new Animated.Value(1)).current;

  const likes = post.likes || [];
  const liked = likes.includes(meId);
  const name = author?.name || 'User';

  const [commentCount, setCommentCount] = useState(null);
  const images = post.images?.length ? post.images : [post.imageURL];
  const songArtwork = post.music?.image || post.music?.artwork;
  const songName = post.music?.name || post.music?.title;
  const [page, setPage] = useState(0);
  const muted = useMuted();
  const [paused, setPaused] = useState(false); // you tapped the song to pause it
  const [manual, setManual] = useState(false); // used where the screen can't tell which post is on screen
  const [songError, setSongError] = useState(false);
  const auto = active !== undefined;
  const on = !!post.music && (auto ? !!active && !paused : manual);
  const heard = on && !muted && !songError;

  // The song plays while this post is on screen and stops when you scroll away.
  // It is only loaded for that one post, so a long feed never loads a song per post.
  useMusic(on ? post.music : null, on, muted, () => setSongError(true));
  useEffect(() => { if (!active) setPaused(false); }, [active]);
  useEffect(() => { setSongError(false); }, [post.music?.url, post.music?.previewUrl]);

  const toggleSong = () => (auto ? setPaused((p) => !p) : setManual((m) => !m));

  // 🔥 LIVE COMMENT COUNT
  useEffect(() => {
    if (!post?.id) return;

    const unsubscribe = subscribeComments(post.id, (comments) => {
      setCommentCount(comments.length);
    });

    return unsubscribe;
  }, [post?.id]);

  const like = () => {
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.35,
        duration: 110,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 110,
        useNativeDriver: true,
      }),
    ]).start();

    onLike && onLike(post);
  };

  return (
    <View style={{ marginBottom: 18 }}>
      {/* HEADER */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingVertical: 8,
          gap: 10,
        }}
      >
        <Pressable
          onPress={() => onOpenAuthor && onOpenAuthor(post.authorId)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            flex: 1,
          }}
        >
          <Avatar
            uri={author?.photoURL}
            name={name}
            size={36}
          />

          <View style={{ flex: 1 }}>
            <T
              weight="semibold"
              size={14}
              numberOfLines={1}
            >
              {author?.username || name}
            </T>

            <T size={11} color="subtext">
              {timeAgo(post.createdAt)}
            </T>
          </View>
        </Pressable>

        {post.authorId === meId && onDelete ? (
          <Pressable
            onPress={() => onDelete(post)}
            hitSlop={10}
          >
            <Ionicons
              name="trash-outline"
              size={20}
              color={colors.subtext}
            />
          </Pressable>
        ) : null}
      </View>

      {/* IMAGES: one photo, or a row you swipe sideways */}
      <View>
        {images.length > 1 ? (
          <FlatList
            data={images}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(u, i) => `${i}-${u}`}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
            renderItem={({ item }) => <Image source={{ uri: item }} style={{ width, height: width, backgroundColor: colors.inputBg }} />}
          />
        ) : (
          <Image source={{ uri: images[0] }} style={{ width, height: width, backgroundColor: colors.inputBg }} />
        )}

        {images.length > 1 ? (
          <View style={{ position: 'absolute', top: 10, right: 10, paddingHorizontal: 9, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center' }}>
            <T size={11} weight="semibold" color="#fff">{page + 1}/{images.length}</T>
          </View>
        ) : null}

        {post.music ? (
          <Pressable onPress={toggleMuted} hitSlop={8} style={{ position: 'absolute', right: 10, bottom: 10, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={16} color="#fff" />
          </Pressable>
        ) : null}
      </View>

      {/* DOTS: which photo you are on */}
      {images.length > 1 ? (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5, paddingTop: 9 }}>
          {images.map((_, i) => (
            <View key={i} style={{ width: i === page ? 7 : 6, height: i === page ? 7 : 6, borderRadius: 4, backgroundColor: i === page ? '#E11D2A' : colors.subtext, opacity: i === page ? 1 : 0.45 }} />
          ))}
        </View>
      ) : null}

      {/* SONG */}
      {post.music ? (
        <Pressable
          onPress={toggleSong}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginTop: 10, paddingLeft: songArtwork ? 5 : 12, paddingRight: 12, height: 36, borderRadius: 18, backgroundColor: colors.inputBg, alignSelf: 'flex-start', maxWidth: width - 24 }}
        >
          {songArtwork ? (
            <View style={{ width: 26, height: 26 }}>
              <Image source={{ uri: songArtwork }} style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.border }} />
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={songError ? 'alert-circle' : heard ? 'pause' : 'play'} size={13} color="#fff" />
              </View>
            </View>
          ) : (
            <Ionicons name={songError ? 'alert-circle' : heard ? 'pause-circle' : 'play-circle'} size={22} color="#E11D2A" />
          )}
          <T size={12} weight="medium" numberOfLines={1} style={{ flexShrink: 1 }}>{songError ? 'Song unavailable' : `${songName} · ${post.music.artist}`}</T>
        </Pressable>
      ) : null}

      {/* ACTIONS */}
      <View
        style={{
          paddingHorizontal: 12,
          paddingTop: 10,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
          }}
        >
          {/* LIKE */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Pressable
              onPress={like}
              hitSlop={10}
            >
              <Animated.View
                style={{
                  transform: [{ scale }],
                }}
              >
                <Ionicons
                  name={liked ? 'heart' : 'heart-outline'}
                  size={28}
                  color={liked ? '#F43F5E' : colors.text}
                />
              </Animated.View>
            </Pressable>

            <T weight="medium" size={14}>
              {likes.length}
            </T>
          </View>

          {/* COMMENTS */}
          <Pressable
            onPress={() => onComment && onComment(post)}
            disabled={!onComment}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
            hitSlop={10}
          >
            <Ionicons
              name="chatbubble-outline"
              size={24}
              color={colors.text}
            />

            {commentCount !== null ? (
              <T weight="medium" size={14}>
                {commentCount}
              </T>
            ) : null}
          </Pressable>
        </View>

        {/* CAPTION */}
        {post.caption ? (
          <T
            size={14}
            style={{ marginTop: 6 }}
          >
            <T weight="semibold" size={14}>
              {author?.username || name}{' '}
            </T>

            {post.caption}
          </T>
        ) : null}

        {/* VIEW COMMENTS */}
        {onComment && commentCount > 0 ? (
          <Pressable
            onPress={() => onComment(post)}
            style={{ marginTop: 4 }}
          >
            <T
              size={13}
              color="subtext"
            >
              View all {commentCount} comments
            </T>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}