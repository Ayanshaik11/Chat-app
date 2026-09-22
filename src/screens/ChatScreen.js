import React, { useEffect, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import { useTheme } from '../context/SettingsContext';
import { chatIdFor, markChatRead, sendMessage } from '../services/chat';
import { clock, isOnline, lastSeenText } from '../utils/helpers';
import { gradientProps } from '../theme';
import Screen from '../components/Screen';
import ScreenHeader from '../components/ScreenHeader';
import Avatar from '../components/Avatar';
import T from '../components/T';

export default function ChatScreen({ route, navigation }) {
  const { user } = route.params;
  const { me } = useAuth();
  const { chats, friendProfiles } = useAppData();
  const { colors, fonts, gradient } = useTheme();
  const chatId = chatIdFor(me.id, user.id);
  const live = friendProfiles[user.id] || user;
  const unread = chats[chatId]?.unread?.[me.id] || 0;
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'desc'), limit(80)),
        (snap) => setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        () => {}
      ),
    [chatId]
  );

  // clear the unread counter while this chat is open
  useEffect(() => {
    if (unread > 0) markChatRead(chatId, me.id).catch(() => {});
  }, [unread, chatId, me.id]);

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setText('');
    try {
      await sendMessage(me, user, t);
    } catch (e) {
      setText(t);
      Alert.alert('Message not sent', e.message);
    }
  };

  const renderItem = ({ item }) => {
    const mine = item.senderId === me.id;
    return (
      <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%', marginVertical: 2 }}>
        <View
          style={{
            backgroundColor: mine ? colors.bubbleMine : colors.bubbleOther,
            borderRadius: 18, borderBottomRightRadius: mine ? 4 : 18, borderBottomLeftRadius: mine ? 18 : 4,
            paddingHorizontal: 13, paddingVertical: 8, borderWidth: mine ? 0 : 1, borderColor: colors.border,
          }}
        >
          <T color={mine ? colors.bubbleMineText : colors.text} size={15}>{item.text}</T>
          <T size={10} color={mine ? 'rgba(255,255,255,0.75)' : 'subtext'} style={{ alignSelf: 'flex-end', marginTop: 2 }}>
            {clock(item.createdAt)}
          </T>
        </View>
      </View>
    );
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader onBack={() => navigation.goBack()}>
        <Pressable
          onPress={() => navigation.navigate('UserProfile', { userId: user.id })}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
        >
          <Avatar uri={live.photoURL} name={live.name} size={38} online={isOnline(live)} />
          <View style={{ flex: 1 }}>
            <T weight="semibold" size={16} numberOfLines={1}>{live.name}</T>
            <T size={11} color={isOnline(live) ? 'primary' : 'subtext'}>{lastSeenText(live)}</T>
          </View>
        </Pressable>
      </ScreenHeader>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flex: 1 }}>
          <FlatList
            inverted
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            contentContainerStyle={{ padding: 12, flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
          />
          {!messages.length ? (
            <View
              pointerEvents="none"
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: 30 }}
            >
              <T color="subtext" style={{ textAlign: 'center' }}>Say hello to {live.name}! 👋</T>
            </View>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', padding: 10, gap: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
          <TextInput
            value={text} onChangeText={setText} placeholder="Message…" placeholderTextColor={colors.subtext} multiline
            style={{
              flex: 1, maxHeight: 110, backgroundColor: colors.inputBg, borderRadius: 22, paddingHorizontal: 16,
              paddingTop: 10, paddingBottom: 10, fontFamily: fonts.regular, fontSize: 15, color: colors.text,
            }}
          />
          <Pressable onPress={send} disabled={!text.trim()} style={{ opacity: text.trim() ? 1 : 0.45 }}>
            <LinearGradient
              colors={gradient} {...gradientProps}
              style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="send" size={19} color="#fff" style={{ marginLeft: 2 }} />
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
