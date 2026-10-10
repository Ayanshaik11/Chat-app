import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import { useTheme } from '../context/SettingsContext';
import { sendMessage } from '../services/chat';
import Screen from '../components/Screen';
import ScreenHeader from '../components/ScreenHeader';
import Avatar from '../components/Avatar';
import EmptyState from '../components/EmptyState';
import T from '../components/T';

/** Shown when something is shared to King X from another app. Pick a friend -> message is sent. */
export default function SharePickerScreen({ route, navigation }) {
  const { text } = route.params || {};
  const { me } = useAuth();
  const { friends } = useAppData();
  const { colors, fonts } = useTheme();
  const [q, setQ] = useState('');
  const [sendingId, setSendingId] = useState(null);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return friends.filter((f) => !s || (f.name || f.displayName || '').toLowerCase().includes(s));
  }, [friends, q]);

  const close = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main'));

  const send = async (friend) => {
    const friendId = friend.id || friend.uid;
    if (sendingId) return;
    setSendingId(friendId);
    try {
      await sendMessage(me.id, friendId, text);
      navigation.replace('Chat', {
        user: me,
        otherUser: {
          id: friendId,
          name: friend.name || friend.displayName || 'User',
          photoURL: friend.photoURL || friend.photoUrl || '',
          email: friend.email || '',
        },
      });
    } catch (e) {
      console.warn('share send failed', e);
      setSendingId(null);
    }
  };

  return (
    <Screen>
      <ScreenHeader title="Send to" onBack={close} />
      <View style={{ margin: 12, padding: 12, borderRadius: 12, backgroundColor: colors.inputBg }}>
        <T size={13} color="subtext" numberOfLines={3}>{text}</T>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.inputBg, borderRadius: 14, paddingHorizontal: 12, marginHorizontal: 12, height: 44, gap: 8 }}>
        <Ionicons name="search" size={19} color={colors.subtext} />
        <TextInput value={q} onChangeText={setQ} placeholder="Search friends" placeholderTextColor={colors.subtext} style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.text }} />
      </View>
      <FlatList
        data={list}
        keyExtractor={(f) => f.id || f.uid}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<EmptyState title="No friends yet" subtitle="Add friends to share with them." />}
        renderItem={({ item }) => {
          const id = item.id || item.uid;
          return (
            <Pressable
              onPress={() => send(item)}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: pressed ? colors.inputBg : 'transparent' })}
            >
              <Avatar uri={item.photoURL || item.photoUrl} name={item.name || item.displayName} size={46} />
              <T weight="semibold" style={{ flex: 1 }} numberOfLines={1}>{item.name || item.displayName || 'User'}</T>
              {sendingId === id ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="send" size={20} color={colors.primary} />}
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}
