import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import { useTheme } from '../context/SettingsContext';
import { chatIdFor, markChatRead, sendMessage, setTyping } from '../services/chat';
import { clock, isOnline, lastSeenText, timeAgo, toMillis } from '../utils/helpers';
import { gradientProps } from '../theme';
import Screen from '../components/Screen';
import ScreenHeader from '../components/ScreenHeader';
import Avatar from '../components/Avatar';
import T from '../components/T';

const TYPING_STOP_DELAY_MS = 2500;

function TypingDots() {
  const { colors } = useTheme();
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  useEffect(() => {
    const anims = dots.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(v, { toValue: 1, duration: 300, easing: Easing.ease, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 300, easing: Easing.ease, useNativeDriver: true }),
          Animated.delay((2 - i) * 150),
        ])
      )
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View
      style={{
        alignSelf: 'flex-start', flexDirection: 'row', gap: 4, backgroundColor: colors.bubbleOther,
        borderWidth: 1, borderColor: colors.border, borderRadius: 18, borderBottomLeftRadius: 4,
        paddingHorizontal: 14, paddingVertical: 12, marginBottom: 6,
      }}
    >
      {dots.map((v, i) => (
        <Animated.View
          key={i}
          style={{
            width: 7, height: 7, borderRadius: 4, backgroundColor: colors.subtext,
            opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
            transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
          }}
        />
      ))}
    </View>
  );
}

export default function ChatScreen({ route, navigation }) {
  const { user } = route.params;
  const { me } = useAuth();
  const { chats, friendProfiles } = useAppData();
  const { colors, fonts, gradient } = useTheme();
  const isFocused = useIsFocused();
  const chatId = chatIdFor(me.id, user.id);
  const live = friendProfiles[user.id] || user;
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const amTypingRef = useRef(false);
  const typingTimeoutRef = useRef(null);

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'desc'), limit(80)),
        (snap) => setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        () => {}
      ),
    [chatId]
  );

  // Mark as read the moment this screen is opened…
  useFocusEffect(
    useCallback(() => {
      markChatRead(chatId, me.id).catch(() => {});
    }, [chatId, me.id])
  );

  // …and again immediately whenever a new message arrives while the chat is
  // already open — this is what makes "Seen" appear right away, not only
  // the next time the chat is reopened.
  useEffect(() => {
    if (isFocused && messages.length) markChatRead(chatId, me.id).catch(() => {});
  }, [isFocused, chatId, me.id, messages[0]?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clears my own "typing" flag if I leave the chat mid-type
  useEffect(
    () => () => {
      clearTimeout(typingTimeoutRef.current);
      if (amTypingRef.current) {
        amTypingRef.current = false;
        setTyping(chatId, me.id, false);
      }
    },
    [chatId, me.id]
  );

  const lastMine = messages[0]?.senderId === me.id ? messages[0] : null;
  const otherLastRead = chats[chatId]?.lastRead?.[user.id];
  const seen = lastMine && otherLastRead && toMillis(otherLastRead) >= toMillis(lastMine.createdAt);
  const otherTyping = !!chats[chatId]?.typing?.[user.id];

  const onChangeText = (t) => {
    setText(t);
    clearTimeout(typingTimeoutRef.current);
    if (t.trim().length > 0) {
      if (!amTypingRef.current) {
        amTypingRef.current = true;
        setTyping(chatId, me.id, true);
      }
      typingTimeoutRef.current = setTimeout(() => {
        amTypingRef.current = false;
        setTyping(chatId, me.id, false);
      }, TYPING_STOP_DELAY_MS);
    } else if (amTypingRef.current) {
      amTypingRef.current = false;
      setTyping(chatId, me.id, false);
    }
  };

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setText('');
    clearTimeout(typingTimeoutRef.current);
    if (amTypingRef.current) {
      amTypingRef.current = false;
      setTyping(chatId, me.id, false);
    }
    try {
      await sendMessage(me, user, t);
    } catch (e) {
      setText(t);
      Alert.alert('Message not sent', e.message);
    }
  };

  const renderItem = ({ item }) => {
    const mine = item.senderId === me.id;
    const showSeen = mine && seen && item.id === lastMine?.id;
    const seenLabel = showSeen ? (timeAgo(otherLastRead) === 'now' ? 'Seen just now' : `Seen ${timeAgo(otherLastRead)} ago`) : null;
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
        {seenLabel ? (
          <T size={11} color="subtext" style={{ alignSelf: 'flex-end', marginTop: 3, marginRight: 2 }}>{seenLabel}</T>
        ) : null}
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
            <T size={11} color={otherTyping ? 'primary' : isOnline(live) ? 'primary' : 'subtext'}>
              {otherTyping ? 'typing…' : lastSeenText(live)}
            </T>
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
            ListHeaderComponent={otherTyping ? <TypingDots /> : null}
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
            value={text} onChangeText={onChangeText} placeholder="Message…" placeholderTextColor={colors.subtext} multiline
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
