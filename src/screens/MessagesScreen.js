import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, SectionList, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import { useTheme } from '../context/SettingsContext';
import { chatIdFor, unreadFor } from '../services/chat';
import { getUsersByIds } from '../services/users';
import { isOnline, timeAgo, toMillis } from '../utils/helpers';
import Screen from '../components/Screen';
import Avatar from '../components/Avatar';
import KingXAIAvatar from '../components/KingXAIAvatar';
import EmptyState from '../components/EmptyState';
import T from '../components/T';
import { usePeerTyping } from '../utils/typing';
import { decryptFrom, useE2EReady } from '../services/crypto';

function PreviewText({ typingValue, preview, unread }) {
  const typing = usePeerTyping(typingValue);
  return (
    <T
      size={13}
      color={typing ? 'primary' : unread ? 'text' : 'subtext'}
      weight={typing || unread ? 'medium' : 'regular'}
      numberOfLines={1}
    >
      {typing ? 'typing...' : preview}
    </T>
  );
}

export default function MessagesScreen({ navigation }) {
  const { me } = useAuth();
  const { friends, friendProfiles, chats } = useAppData();
  const { colors, fonts } = useTheme();
  const [text, setText] = useState('');
  const [extraProfiles, setExtraProfiles] = useState({});
  const e2eReady = useE2EReady();

  const myId = me?.id || null;

  // Chat partners that are not friends (e.g. messaged from a profile) are not
  // in friendProfiles, so their profile is loaded separately.
  const partnerIds = useMemo(() => {
    const ids = [];
    Object.values(chats || {}).forEach((chat) => {
      const members = Array.isArray(chat?.members) && chat.members.length
        ? chat.members
        : String(chat?.id || '').split('_');
      members.forEach((id) => {
        if (id && id !== myId) ids.push(id);
      });
    });
    return [...new Set(ids)];
  }, [chats, myId]);

  const missingKey = partnerIds
    .filter((id) => !friendProfiles[id] && !extraProfiles[id])
    .sort()
    .join(',');

  useEffect(() => {
    if (!missingKey) return undefined;
    let alive = true;
    getUsersByIds(missingKey.split(','))
      .then((list) => {
        if (!alive || !list.length) return;
        setExtraProfiles((prev) => {
          const next = { ...prev };
          list.forEach((u) => { next[u.id] = u; });
          return next;
        });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [missingKey]);

  const profileFor = useCallback(
    (id) => friendProfiles[id] || extraProfiles[id] || null,
    [friendProfiles, extraProfiles]
  );

  const rows = useMemo(() => {
    if (!myId) return [];

    const q = text.trim().toLowerCase();
    const seen = new Set();
    const list = [];

    const add = (id, profile, chat) => {
      if (!id || seen.has(id)) return;
      const name = profile?.name || profile?.displayName || '';
      const email = profile?.email || '';
      if (q && !name.toLowerCase().includes(q) && !email.toLowerCase().includes(q)) return;
      seen.add(id);

      // Only real timestamps count (toMillis(null) would return "now").
      const lastMessageAt = chat?.lastMessageAt ? toMillis(chat.lastMessageAt) : 0;
      const updatedAt = chat?.updatedAt ? toMillis(chat.updatedAt) : 0;
      let lastActivity = Math.max(lastMessageAt, updatedAt);
      // only a message that is still being sent (timestamp not confirmed yet) counts as "now";
      // old chats without any timestamp go to the bottom instead of jumping above new ones
      if (!lastActivity && chat?._pending && chat?.lastMessage) lastActivity = Date.now();

      list.push({
        id,
        profile: profile || { id, name: 'User' },
        chat,
        lastActivity,
        unread: unreadFor(chat, myId),
      });
    };

    // 1) every conversation we have, friend or not -> recent chats come first
    Object.values(chats || {}).forEach((chat) => {
      const members = Array.isArray(chat?.members) && chat.members.length
        ? chat.members
        : String(chat?.id || '').split('_');
      const otherId = members.find((id) => id && id !== myId);
      if (otherId) add(otherId, profileFor(otherId), chat);
    });

    // 2) friends we have not chatted with yet
    friends.forEach((friend) => {
      const id = friend.id || friend.uid;
      add(id, friend, chats?.[chatIdFor(myId, id)] || null);
    });

    return list.sort(
      (a, b) => b.lastActivity - a.lastActivity || String(a.profile?.name || '').localeCompare(String(b.profile?.name || ''))
    );
  }, [friends, chats, text, myId, profileFor]);

  const sections = useMemo(() => {
    const unread = rows.filter((r) => r.unread > 0);
    const recent = rows.filter((r) => r.unread === 0 && r.chat?.lastMessage);
    const friendsOnly = rows.filter((r) => !r.chat?.lastMessage);
    const out = [];
    if (unread.length) out.push({ title: 'New messages', data: unread });
    if (recent.length) out.push({ title: 'Recent', data: recent });
    if (friendsOnly.length) out.push({ title: 'Friends', data: friendsOnly });
    return out;
  }, [rows]);

  const openChat = (profile, id) => {
    navigation.navigate('Chat', {
      user: me,
      otherUser: {
        id,
        name: profile?.name || profile?.displayName || 'User',
        displayName: profile?.displayName || profile?.name || 'User',
        photoURL: profile?.photoURL || profile?.photoUrl || profile?.profilePic || profile?.avatar || '',
        email: profile?.email || '',
      },
    });
  };

  const renderItem = ({ item }) => {
    const { profile, chat, unread, id } = item;
    let lastText = chat?.lastMessage;
    if (chat?.lastEnc) {
      lastText = e2eReady ? (decryptFrom(chat.lastEnc, chat.lastSender) ?? '🔒 Encrypted message') : '🔒 …';
    }
    const preview = lastText ? `${chat.lastSender === myId ? 'You: ' : ''}${lastText}` : 'Say hi 👋';

    return (
      <Pressable
        onPress={() => openChat(profile, id)}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12,
          backgroundColor: pressed ? colors.inputBg : 'transparent',
        })}
      >
        <Avatar
          uri={profile?.photoURL || profile?.photoUrl || profile?.profilePic || profile?.avatar}
          name={profile?.name || profile?.displayName}
          size={54}
          online={isOnline(profile)}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T weight={unread ? 'bold' : 'semibold'} numberOfLines={1}>
            {profile?.name || profile?.displayName || 'User'}
          </T>
          <PreviewText typingValue={chat?.typing?.[id]} preview={preview} unread={unread} />
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          {item.lastActivity > 0 && chat?.lastMessage && (
            <T size={11} color={unread ? 'primary' : 'subtext'} weight={unread ? 'semibold' : 'regular'}>
              {timeAgo(item.lastActivity)}
            </T>
          )}
          {unread > 0 && (
            <View style={{ backgroundColor: colors.primary, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' }}>
              <T size={11} weight="bold" color="#fff">{unread}</T>
            </View>
          )}
        </View>
      </Pressable>
    );
  };

  const renderSectionHeader = ({ section }) => (
    <T
      size={11}
      weight="semibold"
      color="subtext"
      style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4, letterSpacing: 0.8, textTransform: 'uppercase' }}
    >
      {section.title}
    </T>
  );

  return (
    <Screen>
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 }}>
        <T weight="bold" size={24}>Messages</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.inputBg, borderRadius: 14, paddingHorizontal: 12, marginTop: 12, height: 44, gap: 8 }}>
          <Ionicons name="search" size={19} color={colors.subtext} />
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Search friends"
            placeholderTextColor={colors.subtext}
            style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.text }}
          />
        </View>
      </View>

      <SectionList
        ListHeaderComponent={
          !text.trim() || 'king x ai'.includes(text.trim().toLowerCase()) ? (
            <Pressable
              onPress={() => navigation.navigate('KingXAI')}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12,
                backgroundColor: pressed ? colors.inputBg : 'transparent',
              })}
            >
              <KingXAIAvatar size={54} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <T weight="semibold" numberOfLines={1}>King X</T>
                  <View style={{ backgroundColor: colors.primary, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 }}>
                    <T size={9} weight="bold" color="#fff">AI</T>
                  </View>
                </View>
                <T size={13} color="subtext" numberOfLines={1}>Ask me anything - captions, replies, code and more</T>
              </View>
              <Ionicons name="sparkles" size={18} color={colors.primary} />
            </Pressable>
          ) : null
        }
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={false}
        ListEmptyComponent={
          <EmptyState
            icon="chatbubbles-outline"
            title={text.trim() ? 'No results' : 'No messages'}
            text={text.trim() ? 'Try another name or email.' : 'Start a conversation with a friend.'}
          />
        }
      />
    </Screen>
  );
}
