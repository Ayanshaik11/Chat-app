import React, { useRef } from 'react';
import { Animated, Image, Pressable, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/SettingsContext';
import { timeAgo } from '../utils/helpers';
import Avatar from './Avatar';
import T from './T';

export default function PostCard({ post, author, meId, onLike, onDelete, onOpenAuthor }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const scale = useRef(new Animated.Value(1)).current;
  const likes = post.likes || [];
  const liked = likes.includes(meId);
  const name = author?.name || 'User';

  const like = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.35, duration: 110, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 110, useNativeDriver: true }),
    ]).start();
    onLike && onLike(post);
  };

  return (
    <View style={{ marginBottom: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 10 }}>
        <Pressable onPress={() => onOpenAuthor && onOpenAuthor(post.authorId)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          <Avatar uri={author?.photoURL} name={name} size={36} />
          <View style={{ flex: 1 }}>
            <T weight="semibold" size={14} numberOfLines={1}>{author?.username || name}</T>
            <T size={11} color="subtext">{timeAgo(post.createdAt)}</T>
          </View>
        </Pressable>
        {post.authorId === meId && onDelete ? (
          <Pressable onPress={() => onDelete(post)} hitSlop={10}>
            <Ionicons name="trash-outline" size={20} color={colors.subtext} />
          </Pressable>
        ) : null}
      </View>

      <Image source={{ uri: post.imageURL }} style={{ width, height: width, backgroundColor: colors.inputBg }} />

      <View style={{ paddingHorizontal: 12, paddingTop: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable onPress={like} hitSlop={10}>
            <Animated.View style={{ transform: [{ scale }] }}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={28} color={liked ? '#F43F5E' : colors.text} />
            </Animated.View>
          </Pressable>
          <T weight="medium" size={14}>{likes.length} {likes.length === 1 ? 'like' : 'likes'}</T>
        </View>
        {post.caption ? (
          <T size={14} style={{ marginTop: 6 }}>
            <T weight="semibold" size={14}>{author?.username || name} </T>
            {post.caption}
          </T>
        ) : null}
      </View>
    </View>
  );
}
