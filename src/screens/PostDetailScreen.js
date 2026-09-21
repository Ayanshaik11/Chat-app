import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useSettings, useTheme } from '../context/SettingsContext';
import { deletePost, getPost, toggleLike } from '../services/posts';
import Screen from '../components/Screen';
import ScreenHeader from '../components/ScreenHeader';
import PostCard from '../components/PostCard';
import T from '../components/T';

export default function PostDetailScreen({ route, navigation }) {
  const { postId } = route.params;
  const { me } = useAuth();
  const { vibrate } = useSettings();
  const { colors } = useTheme();
  const [post, setPost] = useState(null);
  const [author, setAuthor] = useState(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <Screen>
      <ScreenHeader title="Post" onBack={() => navigation.goBack()} />
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : post ? (
        <ScrollView>
          <PostCard
            post={post} author={author} meId={me.id} onLike={onLike} onDelete={onDelete}
            onOpenAuthor={(uid) => navigation.navigate('UserProfile', { userId: uid })}
          />
        </ScrollView>
      ) : (
        <T color="subtext" style={{ textAlign: 'center', marginTop: 40 }}>This post is no longer available.</T>
      )}
    </Screen>
  );
}
