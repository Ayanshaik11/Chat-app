import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import { useSettings, useTheme } from '../context/SettingsContext';
import { deletePost, getPost, toggleLike } from '../services/posts';
import { addComment, deleteComment, subscribeComments } from '../services/comments';
import { timeAgo } from '../utils/helpers';
import Screen from '../components/Screen';
import ScreenHeader from '../components/ScreenHeader';
import PostCard from '../components/PostCard';
import Avatar from '../components/Avatar';
import T from '../components/T';

function CommentRow({ comment, canDelete, onDelete, onOpenAuthor }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingVertical: 8 }}>
      <Pressable onPress={() => onOpenAuthor(comment.authorId)}>
        <Avatar uri={comment.authorPhoto} name={comment.authorName} size={32} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <T size={14}>
          <T weight="semibold" size={14}>{comment.authorName} </T>
          {comment.text}
        </T>
        <T size={11} color="subtext" style={{ marginTop: 2 }}>{timeAgo(comment.createdAt)}</T>
      </View>
      {canDelete ? (
        <Pressable onPress={() => onDelete(comment)} hitSlop={10}>
          <Ionicons name="trash-outline" size={16} color={colors.subtext} />
        </Pressable>
      ) : null}
    </View>
  );
}

export default function PostDetailScreen({ route, navigation }) {
  const { postId, focusComment } = route.params;
  const { me } = useAuth();
  const { friendProfiles } = useAppData();
  const { vibrate } = useSettings();
  const { colors, fonts } = useTheme();
  const [post, setPost] = useState(null);
  const [author, setAuthor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const p = await getPost(postId);
        setPost(p);
        if (p) {
          const a = await getDoc(doc(db, 'users', p.authorId));
          setAuthor(a.exists() ? { id: a.id, ...a.data() } : null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [postId]);

  useEffect(() => subscribeComments(postId, setComments), [postId]);

  useEffect(() => {
    if (focusComment && !loading) {
      const t = setTimeout(() => inputRef.current?.focus(), 300);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [focusComment, loading]);

  const onLike = (p) => {
    const liked = (p.likes || []).includes(me.id);
    setPost({ ...p, likes: liked ? p.likes.filter((x) => x !== me.id) : [...(p.likes || []), me.id] });
    if (!liked) vibrate(15);
    toggleLike(p.id, me.id, liked).catch(() => {});
  };

  const onDelete = (p) =>
    Alert.alert('Delete post?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deletePost(p).catch(() => {});
          navigation.goBack();
        },
      },
    ]);

  const send = async () => {
    const t = text.trim();
    if (!t || !post) return;
    setText('');
    setSending(true);
    try {
      await addComment(post.id, me, t);
    } catch (e) {
      setText(t);
      Alert.alert('Comment not sent', e.message);
    } finally {
      setSending(false);
    }
  };

  const onDeleteComment = (comment) =>
    Alert.alert('Delete comment?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteComment(post.id, comment.id).catch(() => {}) },
    ]);

  const openAuthor = (uid) => navigation.navigate('UserProfile', { userId: uid });

  // friend name/photo can be stale on a comment's cached fields — prefer live data when we have it
  const liveComments = comments.map((c) => {
    const live = c.authorId === me.id ? me : friendProfiles[c.authorId];
    return live ? { ...c, authorName: live.name, authorPhoto: live.photoURL } : c;
  });

  if (loading) return <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />;

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader title="Post" onBack={() => navigation.goBack()} />
      {post ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <FlatList
            data={liveComments}
            keyExtractor={(c) => c.id}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <PostCard
                post={post} author={author} meId={me.id} onLike={onLike} onDelete={onDelete}
                onOpenAuthor={openAuthor}
              />
            }
            renderItem={({ item }) => (
              <CommentRow
                comment={item}
                canDelete={item.authorId === me.id || post.authorId === me.id}
                onDelete={onDeleteComment}
                onOpenAuthor={openAuthor}
              />
            )}
            ListFooterComponent={
              !comments.length ? (
                <T color="subtext" style={{ textAlign: 'center', paddingVertical: 16 }}>No comments yet — be the first!</T>
              ) : null
            }
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 10, gap: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Avatar uri={me.photoURL} name={me.name} size={32} />
            <TextInput
              ref={inputRef}
              value={text} onChangeText={setText} placeholder="Add a comment…" placeholderTextColor={colors.subtext}
              style={{
                flex: 1, height: 40, backgroundColor: colors.inputBg, borderRadius: 20, paddingHorizontal: 16,
                fontFamily: fonts.regular, fontSize: 14, color: colors.text,
              }}
            />
            <Pressable onPress={send} disabled={!text.trim() || sending} hitSlop={10} style={{ opacity: text.trim() ? 1 : 0.4 }}>
              <T weight="semibold" size={14} color="primary">Post</T>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      ) : (
        <T color="subtext" style={{ textAlign: 'center', marginTop: 40 }}>This post is no longer available.</T>
      )}
    </Screen>
  );
}
