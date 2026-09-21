import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, View, useWindowDimensions } from 'react-native';
import { doc, onSnapshot } from 'firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import { useTheme } from '../context/SettingsContext';
import { fetchUserPosts } from '../services/posts';
import { fetchStories } from '../services/stories';
import { toMillis } from '../utils/helpers';
import Avatar from '../components/Avatar';
import Btn from '../components/Btn';
import RelationButton from '../components/RelationButton';
import EmptyState from '../components/EmptyState';
import T from '../components/T';

const Stat = ({ n, label }) => (
  <View style={{ alignItems: 'center' }}>
    <T weight="bold" size={18}>{n}</T>
    <T size={12} color="subtext">{label}</T>
  </View>
);

// Shared by "My profile" and "Other person's profile"
export default function ProfileView({ userId, navigation }) {
  const { me } = useAuth();
  const { friendIds, friends } = useAppData();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isSelf = userId === me.id;
  const canSee = isSelf || friendIds.includes(userId);

  const [user, setUser] = useState(isSelf ? me : null);
  const [missing, setMissing] = useState(false);
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isSelf) {
      setUser(me);
      return undefined;
    }
    return onSnapshot(
      doc(db, 'users', userId),
      (s) => (s.exists() ? setUser({ id: s.id, ...s.data() }) : setMissing(true)),
      () => setMissing(true)
    );
  }, [userId, isSelf, me]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        try {
          if (!canSee) return;
          const [p, s] = await Promise.all([fetchUserPosts(userId), fetchStories([userId])]);
          if (alive) {
            setPosts(p);
            setStories(s);
          }
        } catch (e) {
          console.warn('profile load failed', e);
        } finally {
          if (alive) setLoading(false);
        }
      })();
      return () => {
        alive = false;
      };
    }, [userId, canSee])
  );

  const openStories = () => {
    if (!stories.length || !user) return;
    const list = stories
      .map((s) => ({
        id: s.id, authorId: s.authorId, mediaURL: s.mediaURL, mediaType: s.mediaType,
        createdAt: toMillis(s.createdAt), expiresAt: toMillis(s.expiresAt), storagePath: s.storagePath || '',
      }))
      .sort((a, b) => a.createdAt - b.createdAt);
    navigation.navigate('StoryViewer', {
      groups: [{ user: { id: user.id, name: user.name || 'User', photoURL: user.photoURL || '' }, stories: list }],
      groupIndex: 0,
    });
  };

  if (missing) return <EmptyState icon="alert-circle-outline" title="Profile not found" />;
  if (!user) return <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />;

  const header = (
    <View style={{ padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable onPress={openStories}>
          <Avatar uri={user.photoURL} name={user.name} size={82} ring={stories.length ? 'active' : 'none'} />
        </Pressable>
        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-around' }}>
          <Stat n={posts.length} label="Posts" />
          {isSelf ? <Stat n={friends.length} label="Friends" /> : <Stat n={stories.length} label="Stories" />}
        </View>
      </View>

      <View>
        <T weight="semibold" size={16}>{user.name}</T>
        <T size={13} color="subtext">@{user.username}</T>
        {user.about ? <T size={14} style={{ marginTop: 6 }}>{user.about}</T> : null}
      </View>

      {isSelf ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Btn small variant="soft" icon="create-outline" label="Edit profile" style={{ flex: 1 }} onPress={() => navigation.navigate('EditProfile')} />
          <Btn small icon="add" label="Add post" style={{ flex: 1 }} onPress={() => navigation.navigate('Create', { mode: 'post' })} />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <RelationButton user={user} small style={{ minWidth: 130 }} />
          {canSee ? (
            <Btn
              small variant="soft" icon="chatbubble-outline" label="Message"
              onPress={() => navigation.navigate('Chat', { user: { id: user.id, name: user.name, photoURL: user.photoURL || '' } })}
            />
          ) : null}
        </View>
      )}
    </View>
  );

  const tile = Math.floor(width / 3);
  return (
    <FlatList
      data={canSee ? posts : []}
      keyExtractor={(p) => p.id}
      numColumns={3}
      ListHeaderComponent={header}
      renderItem={({ item }) => (
        <Pressable onPress={() => navigation.navigate('PostDetail', { postId: item.id })} style={{ width: tile, height: tile, padding: 1 }}>
          <Image source={{ uri: item.imageURL }} style={{ flex: 1, backgroundColor: colors.inputBg }} />
        </Pressable>
      )}
      ListEmptyComponent={
        loading && canSee ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
        ) : !canSee ? (
          <EmptyState icon="lock-closed-outline" title="Posts are for friends" text="Become friends to see their posts and stories." />
        ) : (
          <EmptyState icon="camera-outline" title="No posts yet" text={isSelf ? 'Share your first photo.' : undefined} />
        )
      }
    />
  );
}
