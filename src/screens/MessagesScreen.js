import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, SectionList, TextInput, View } from 'react-native';
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
import GroupAvatar from '../components/GroupAvatar';
import { createGroup, defaultGroupName, MAX_GROUP_MEMBERS, MAX_GROUP_NAME } from '../services/groups';
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

  // group creation: long-press a friend to start picking people
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState([]);
  const [nameOpen, setNameOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [creating, setCreating] = useState(false);

  const myId = me?.id || null;

  // Chat partners that are not friends (e.g. messaged from a profile) are not
  // in friendProfiles, so their profile is loaded separately.
  const partnerIds = useMemo(() => {
    const ids = [];
    Object.values(chats || {}).forEach((chat) => {
      if (chat?.isGroup) return;
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

    // 0) group chats (only the ones I am still in)
    Object.values(chats || {}).forEach((chat) => {
      if (!chat?.isGroup || !(chat.members || []).includes(myId)) return;
      const gname = chat.name || 'Group';
      if (q && !gname.toLowerCase().includes(q)) return;
      const lastMessageAt = chat.lastMessageAt ? toMillis(chat.lastMessageAt) : 0;
      const updatedAt = chat.updatedAt ? toMillis(chat.updatedAt) : 0;
      let lastActivity = Math.max(lastMessageAt, updatedAt);
      if (!lastActivity && chat._pending) lastActivity = Date.now();
      seen.add(chat.id);
      list.push({ id: chat.id, isGroup: true, profile: { id: chat.id, name: gname, photoURL: chat.photoURL || '' }, chat, lastActivity, unread: unreadFor(chat, myId) });
    });

    // 1) every conversation we have, friend or not -> recent chats come first
    Object.values(chats || {}).forEach((chat) => {
      if (chat?.isGroup) return;
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

  const openGroup = (chat) => navigation.navigate('Chat', { user: me, groupId: chat.id, groupName: chat.name || 'Group' });

  const toggleSelect = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const stopSelecting = () => { setSelecting(false); setPicked([]); };

  // only friends can be picked (not groups, not people who are not friends)
  const startSelecting = (id) => {
    if (!friendProfiles[id]) return;
    setSelecting(true);
    setPicked((p) => (p.includes(id) ? p : [...p, id]));
  };

  const pickedNames = picked.map((id) => friendProfiles[id]?.name || friendProfiles[id]?.displayName || 'Friend');

  const openNameStep = () => {
    if (!picked.length) return;
    if (picked.length + 1 > MAX_GROUP_MEMBERS) {
      Alert.alert('Too many people', `A group can have up to ${MAX_GROUP_MEMBERS} people.`);
      return;
    }
    setGroupName('');
    setNameOpen(true);
  };

  const makeGroup = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const { id, name } = await createGroup({ me, name: groupName, memberIds: picked, memberNames: pickedNames });
      setNameOpen(false);
      stopSelecting();
      navigation.navigate('Chat', { user: me, groupId: id, groupName: name });
    } catch (e) {
      Alert.alert('Could not create the group', e?.message || 'Please try again.');
    }
    setCreating(false);
  };

  const renderItem = ({ item }) => {
    const { profile, chat, unread, id, isGroup } = item;
    let lastText = chat?.lastMessage;
    if (chat?.lastEnc) {
      lastText = e2eReady ? (decryptFrom(chat.lastEnc, chat.lastSender) ?? '🔒 Encrypted message') : '🔒 …';
    }
    let preview;
    if (isGroup) {
      const who = chat.lastSender === myId ? 'You: ' : chat.lastSenderName ? `${chat.lastSenderName}: ` : '';
      preview = lastText ? `${who}${lastText}` : 'Say hi to the group 👋';
    } else {
      preview = lastText ? `${chat.lastSender === myId ? 'You: ' : ''}${lastText}` : 'Say hi 👋';
    }

    // a group's typing value: whoever typed most recently
    let typingValue = chat?.typing?.[id];
    if (isGroup) {
      typingValue = Object.entries(chat?.typing || {}).reduce((best, [uid, v]) => (uid !== myId && typeof v === 'number' && v > best ? v : best), 0);
    }

    const selectable = !isGroup && !!friendProfiles[id];
    const isPicked = picked.includes(id);

    return (
      <Pressable
        onPress={() => {
          if (selecting) { if (selectable) toggleSelect(id); return; }
          if (isGroup) openGroup(chat); else openChat(profile, id);
        }}
        onLongPress={() => { if (!selecting && selectable) startSelecting(id); }}
        delayLongPress={350}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12,
          backgroundColor: isPicked ? colors.inputBg : pressed ? colors.inputBg : 'transparent',
          opacity: selecting && !selectable ? 0.45 : 1,
        })}
      >
        {isGroup ? (
          <GroupAvatar uri={profile?.photoURL} size={54} />
        ) : (
          <Avatar
            uri={profile?.photoURL || profile?.photoUrl || profile?.profilePic || profile?.avatar}
            name={profile?.name || profile?.displayName}
            size={54}
            online={isOnline(profile)}
          />
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <T weight={unread ? 'bold' : 'semibold'} numberOfLines={1}>
            {profile?.name || profile?.displayName || 'User'}
          </T>
          <PreviewText typingValue={typingValue} preview={preview} unread={unread} />
        </View>
        {selecting ? (
          selectable ? (
            <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: isPicked ? colors.primary : colors.border, backgroundColor: isPicked ? colors.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              {isPicked ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}
            </View>
          ) : null
        ) : (
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
        )}
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
        {selecting ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable onPress={stopSelecting} hitSlop={10}>
              <Ionicons name="close" size={26} color={colors.text} />
            </Pressable>
            <T weight="bold" size={20} style={{ flex: 1 }}>{picked.length ? `${picked.length} selected` : 'Select friends'}</T>
            <Pressable
              onPress={openNameStep}
              disabled={!picked.length}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 14, height: 36, opacity: picked.length ? 1 : 0.45 }}
            >
              <Ionicons name="people" size={16} color="#fff" />
              <T weight="semibold" size={13} color="#fff">Create group</T>
            </Pressable>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <T weight="bold" size={24} style={{ flex: 1 }}>Messages</T>
            <Pressable onPress={() => setSelecting(true)} hitSlop={10} accessibilityLabel="New group">
              <Ionicons name="people-outline" size={24} color={colors.text} />
            </Pressable>
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.inputBg, borderRadius: 14, paddingHorizontal: 12, marginTop: 12, height: 44, gap: 8 }}>
          <Ionicons name="search" size={19} color={colors.subtext} />
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Search chats and friends"
            placeholderTextColor={colors.subtext}
            style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.text }}
          />
        </View>
      </View>

      <SectionList
        ListHeaderComponent={
          !selecting && (!text.trim() || 'king x ai'.includes(text.trim().toLowerCase())) ? (
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
        extraData={`${selecting}-${picked.join(',')}`}
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

      {/* name the new group */}
      <Modal visible={nameOpen} transparent animationType="fade" onRequestClose={() => setNameOpen(false)}>
        <Pressable onPress={() => setNameOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,.6)', justifyContent: 'center', padding: 24 }}>
          <Pressable style={{ backgroundColor: colors.card, borderRadius: 20, padding: 18 }}>
            <T weight="bold" size={17}>New group</T>
            <T size={12} color="subtext" style={{ marginTop: 2, marginBottom: 12 }} numberOfLines={2}>
              {`You + ${pickedNames.join(', ')}`}
            </T>
            <TextInput
              value={groupName}
              onChangeText={setGroupName}
              maxLength={MAX_GROUP_NAME}
              autoFocus
              placeholder={defaultGroupName(pickedNames)}
              placeholderTextColor={colors.subtext}
              style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.text, backgroundColor: colors.inputBg, borderRadius: 12, paddingHorizontal: 14, height: 46 }}
            />
            <T size={11} color="subtext" style={{ marginTop: 6 }}>Leave it empty to use the suggested name. You can change it any time.</T>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <Pressable onPress={() => setNameOpen(false)} style={{ paddingHorizontal: 16, height: 40, justifyContent: 'center' }}>
                <T color="subtext" weight="medium">Cancel</T>
              </Pressable>
              <Pressable onPress={makeGroup} disabled={creating} style={{ paddingHorizontal: 20, height: 40, borderRadius: 20, backgroundColor: colors.primary, justifyContent: 'center', minWidth: 90, alignItems: 'center' }}>
                {creating ? <ActivityIndicator color="#fff" /> : <T color="#fff" weight="semibold">Create</T>}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}
