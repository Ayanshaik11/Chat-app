import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import { useSettings, useTheme } from '../context/SettingsContext';
import { cleanupMyExpiredStories, fetchStories } from '../services/stories';
import { deletePost, fetchFeed, toggleLike } from '../services/posts';
import { getSeen } from '../utils/seen';
import { toMillis } from '../utils/helpers';
import { gradientProps } from '../theme';
import Screen from '../components/Screen';
import Avatar from '../components/Avatar';
import PostCard from '../components/PostCard';
import EmptyState from '../components/EmptyState';
import T from '../components/T';

function StoryTile({ name, uri, ring, own, onPress, onAdd }) {
  const { colors, gradient } = useTheme();
  return (
    <Pressable onPress={onPress} style={{ alignItems: 'center', width: 82 }}>
      <View>
        <Avatar uri={uri} name={name} size={62} ring={ring} />
        {own ? (
          <Pressable onPress={onAdd} hitSlop={8} style={{ position: 'absolute', right: 2, bottom: 2 }}>
            <LinearGradient
              colors={gradient}
              {...gradientProps}
              style={{
                width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                borderWidth: 2, borderColor: colors.bg,
              }}
            >
              <Ionicons name="add" size={16} color="#fff" />
            </LinearGradient>
          </Pressable>
        ) : null}
      </View>
      <T size={11} numberOfLines={1} style={{ marginTop: 4, maxWidth: 74 }}>{own ? 'Your story' : name}</T>
    </Pressable>
  );
}

export default function HomeScreen({ navigation }) {
  const { me } = useAuth();
  const { friendIds, friendProfiles, unreadMessages } = useAppData();
  const { vibrate } = useSettings();
  const { colors, fonts } = useTheme();
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [seen, setSeen] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const cleaned = useRef(false);

  const audienceKey = [me.id, ...friendIds].sort().join(',');
  const audience = useMemo(() => audienceKey.split(','), [audienceKey]);
  const people = useMemo(() => ({ [me.id]: me, ...friendProfiles }), [me, friendProfiles]);

  const load = useCallback(async () => {
    try {
      const [p, s, sn] = await Promise.all([fetchFeed(audience), fetchStories(audience), getSeen()]);
      setPosts(p);
      setStories(s);
      setSeen(sn);
      if (!cleaned.current) {
        cleaned.current = true;
        cleanupMyExpiredStories(me.id).catch(() => {});
      }
    } catch (e) {
      console.warn('feed load failed', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [audience, me.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // group stories by person (plain objects, safe for navigation params)
  const { myGroup, others } = useMemo(() => {
    const byUser = {};
    stories.forEach((s) => {
      (byUser[s.authorId] = byUser[s.authorId] || []).push({
        id: s.id, authorId: s.authorId, mediaURL: s.mediaURL, mediaType: s.mediaType,
        createdAt: toMillis(s.createdAt), expiresAt: toMillis(s.expiresAt), storagePath: s.storagePath || '',
        viewedBy: s.viewedBy || [], likedBy: s.likedBy || [],
      });
    });
    const groups = Object.entries(byUser)
      .map(([uid, list]) => {
        const u = people[uid];
        if (!u) return null;
        list.sort((a, b) => a.createdAt - b.createdAt);
        return {
          user: { id: u.id, name: u.name || 'User', photoURL: u.photoURL || '' },
          stories: list,
          allSeen: list.every((x) => seen[x.id]),
        };
      })
      .filter(Boolean);
    return {
      myGroup: groups.find((g) => g.user.id === me.id),
      others: groups.filter((g) => g.user.id !== me.id).sort((a, b) => Number(a.allSeen) - Number(b.allSeen)),
    };
  }, [stories, people, seen, me.id]);

  const viewerGroups = useMemo(() => [...(myGroup ? [myGroup] : []), ...others], [myGroup, others]);
  const openGroup = (uid) =>
    navigation.navigate('StoryViewer', { groups: viewerGroups, groupIndex: viewerGroups.findIndex((g) => g.user.id === uid) });
  const addStory = () => navigation.navigate('Create', { mode: 'story' });

  const onLike = (post) => {
    const liked = (post.likes || []).includes(me.id);
    setPosts((ps) =>
      ps.map((p) =>
        p.id === post.id
          ? { ...p, likes: liked ? p.likes.filter((x) => x !== me.id) : [...(p.likes || []), me.id] }
          : p
      )
    );
    if (!liked) vibrate(15);
    toggleLike(post.id, me.id, liked).catch(() => load());
  };

  const onDelete = (post) =>
    Alert.alert('Delete post?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          setPosts((ps) => ps.filter((p) => p.id !== post.id));
          await deletePost(post).catch(() => {});
        },
      },
    ]);

  const newMenu = () =>
    Alert.alert('Create', undefined, [
      { text: 'New post', onPress: () => navigation.navigate('Create', { mode: 'post' }) },
      { text: 'New story', onPress: addStory },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const header = (
    <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 12 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 10 }}>
        <StoryTile
          own name={me.name} uri={me.photoURL}
          ring={myGroup ? 'active' : 'none'}
          onPress={() => (myGroup ? openGroup(me.id) : addStory())}
          onAdd={addStory}
        />
        {others.map((g) => (
          <StoryTile
            key={g.user.id} name={g.user.name} uri={g.user.photoURL}
            ring={g.allSeen ? 'seen' : 'active'} onPress={() => openGroup(g.user.id)}
          />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 56 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <MaterialCommunityIcons name="crown-outline" size={26} color={colors.primary} />
          <Text style={{ fontFamily: fonts.logo, fontSize: 30, color: colors.text, lineHeight: 34 }}>KING X</Text>
        </View>
        <Pressable onPress={newMenu} hitSlop={10} style={{ marginRight: 18 }}>
          <Ionicons name="add-circle-outline" size={28} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Messages')} hitSlop={10}>
          <Ionicons name="paper-plane-outline" size={25} color={colors.text} />
          {unreadMessages > 0 ? (
            <View style={{ position: 'absolute', top: -6, right: -8, backgroundColor: colors.accent, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center' }}>
              <T size={10} weight="bold" color="#fff">{unreadMessages}</T>
            </View>
          ) : null}
        </Pressable>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <PostCard
            post={item} author={people[item.authorId]} meId={me.id}
            onLike={onLike} onDelete={onDelete}
            onComment={(post) => navigation.navigate('PostDetail', { postId: post.id, focusComment: true })}
            onOpenAuthor={(uid) => (uid === me.id ? navigation.navigate('Profile') : navigation.navigate('UserProfile', { userId: uid }))}
          />
        )}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <EmptyState
              icon="images-outline" title="No posts yet"
              text="Share your first photo or find friends to see their posts here."
              actionLabel="Find people" onAction={() => navigation.navigate('Find')}
            />
          )
        }
      />
    </Screen>
  );
}
