import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import { useTheme } from '../context/SettingsContext';
import { chatIdFor } from '../services/chat';
import { isOnline, timeAgo, toMillis } from '../utils/helpers';
import Screen from '../components/Screen';
import Avatar from '../components/Avatar';
import EmptyState from '../components/EmptyState';
import T from '../components/T';

export default function MessagesScreen({ navigation }) {
  const { me } = useAuth();
  const { friends, chats } = useAppData();
  const { colors, fonts } = useTheme();
  const [text, setText] = useState('');

  const rows = useMemo(() => {
    const q = text.trim().toLowerCase();
    return friends
      .filter((f) => !q || (f.name || '').toLowerCase().includes(q) || (f.email || '').toLowerCase().includes(q))
      .map((f) => ({ friend: f, chat: chats[chatIdFor(me.id, f.id)] }))
      .sort((a, b) => (b.chat ? toMillis(b.chat.lastMessageAt) : 0) - (a.chat ? toMillis(a.chat.lastMessageAt) : 0));
  }, [friends, chats, text, me.id]);

  const renderItem = ({ item: { friend, chat } }) => {
    const unread = chat?.unread?.[me.id] || 0;
    const preview = chat?.lastMessage
      ? `${chat.lastSender === me.id ? 'You: ' : ''}${chat.lastMessage}`
      : 'Say hi 👋';
    return (
      <Pressable
        onPress={() => navigation.navigate('Chat', { user: { id: friend.id, name: friend.name, photoURL: friend.photoURL || '' } })}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12,
          backgroundColor: pressed ? colors.inputBg : 'transparent',
        })}
      >
        <Avatar uri={friend.photoURL} name={friend.name} size={54} online={isOnline(friend)} />
        <View style={{ flex: 1 }}>
          <T weight={unread ? 'bold' : 'semibold'} numberOfLines={1}>{friend.name}</T>
          <T size={13} color={unread ? 'text' : 'subtext'} weight={unread ? 'medium' : 'regular'} numberOfLines={1}>{preview}</T>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          {chat?.lastMessageAt ? <T size={11} color="subtext">{timeAgo(chat.lastMessageAt)}</T> : null}
          {unread > 0 ? (
            <View style={{ backgroundColor: colors.primary, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' }}>
              <T size={11} weight="bold" color="#fff">{unread}</T>
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  };

  return (
    <Screen>
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 }}>
        <T weight="bold" size={24}>Messages</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.inputBg, borderRadius: 14, paddingHorizontal: 12, marginTop: 12, height: 44, gap: 8 }}>
          <Ionicons name="search" size={19} color={colors.subtext} />
          <TextInput
            value={text} onChangeText={setText} placeholder="Search friends" placeholderTextColor={colors.subtext}
            style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.text }}
          />
        </View>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.friend.id}
        renderItem={renderItem}
        ListEmptyComponent={
          <EmptyState
            icon="chatbubbles-outline" title={text ? 'No match' : 'No chats yet'}
            text={text ? 'Try another name.' : 'Add friends to start chatting.'}
            actionLabel={text ? undefined : 'Find people'} onAction={() => navigation.navigate('Find')}
          />
        }
      />
    </Screen>
  );
}
