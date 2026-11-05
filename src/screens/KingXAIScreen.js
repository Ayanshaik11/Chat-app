import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/SettingsContext';
import { gradientProps } from '../theme';
import { QUICK_PROMPTS, greetingFor } from '../config/kingxai';
import {
  askKingXAI, clearCachedHistory, clearHistory, fetchHistory, friendlyError, loadCachedHistory, saveCachedHistory,
} from '../services/kingxai';

import Screen from '../components/Screen';
import T from '../components/T';
import KingXAIAvatar from '../components/KingXAIAvatar';
import KingXAIThinking from '../components/KingXAIThinking';
import { CopyButton, Markdown, TypedMarkdown } from '../components/KingXAIMarkdown';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let counter = 0;
const nextId = () => `s_${Date.now()}_${counter++}`;

/* one message: my messages are red bubbles, King X AI answers are open text with a Copy button */
const Message = React.memo(function Message({ item, typing, skipKey, onTypingDone, onRetry }) {
  const { colors } = useTheme();

  if (item.role === 'user') {
    return (
      <View style={{ alignItems: 'flex-end', paddingHorizontal: 14, marginVertical: 5 }}>
        <View style={{ maxWidth: '84%', backgroundColor: colors.bubbleMine, borderRadius: 20, borderBottomRightRadius: 6, paddingHorizontal: 14, paddingVertical: 9 }}>
          <T selectable size={15} color={colors.bubbleMineText} style={{ lineHeight: 22 }}>{item.text}</T>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 14, marginVertical: 7 }}>
      <KingXAIAvatar size={30} />
      <View style={{ flex: 1, minWidth: 0 }}>
        {item.error ? (
          <View style={{ gap: 8, alignItems: 'flex-start' }}>
            <T size={14} color="danger">{item.error}</T>
            <Pressable onPress={() => onRetry(item)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 32, borderRadius: 16, backgroundColor: colors.inputBg }}>
              <Ionicons name="refresh" size={15} color={colors.text} />
              <T size={13} weight="semibold">Try again</T>
            </Pressable>
          </View>
        ) : typing ? (
          <TypedMarkdown text={item.text} skipKey={skipKey} onDone={() => onTypingDone(item.id)} />
        ) : (
          <>
            <Markdown text={item.text} />
            <View style={{ flexDirection: 'row', marginTop: 6 }}>
              <CopyButton text={item.text} color={colors.subtext} />
            </View>
          </>
        )}
      </View>
    </View>
  );
});

export default function KingXAIScreen({ navigation }) {
  const { fbUser, me, googleId } = useAuth();
  const { colors, fonts } = useTheme();
  const uid = fbUser?.uid || googleId || 'me';
  const userName = me?.name || fbUser?.displayName || '';

  const [history, setHistory] = useState([]); // saved earlier (private to this user)
  const [session, setSession] = useState([]); // this visit
  const [thinking, setThinking] = useState(true);
  const [typingId, setTypingId] = useState(null);
  const [doneIds, setDoneIds] = useState({});
  const [skipKey, setSkipKey] = useState(0);
  const [input, setInput] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(true);

  const scrollRef = useRef(null);
  const stick = useRef(true);
  const sessionRef = useRef([]);
  const historyRef = useRef([]);
  sessionRef.current = session;
  historyRef.current = history;

  const busy = thinking || !!typingId;
  const hasUserMessage = session.some((m) => m.role === 'user');

  const scrollEnd = useCallback((animated = false) => {
    if (stick.current) requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated }));
  }, []);

  /* add a King X AI message that types itself out */
  const addAnswer = useCallback((text, extra = {}) => {
    const id = nextId();
    setSession((s) => [...s, { id, role: 'model', text, ...extra }]);
    setTypingId(id);
    stick.current = true;
  }, []);

  /* opening the chat: show saved messages, then greet the user by name */
  useEffect(() => {
    let alive = true;
    (async () => {
      const cached = await loadCachedHistory(uid);
      if (alive && cached.length) { setHistory(cached); historyRef.current = cached; }

      const refresh = fetchHistory(fbUser)
        .then((list) => { if (alive) { setHistory(list); historyRef.current = list; saveCachedHistory(uid, list); } })
        .catch(() => {}); // offline or older backend: the saved copy on the phone is used
      setLoadingHistory(false);

      await Promise.all([sleep(900), Promise.race([refresh, sleep(1800)])]);
      if (!alive) return;
      setThinking(false);
      addAnswer(greetingFor(userName), { local: true });
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const persist = useCallback(() => {
    saveCachedHistory(uid, [...historyRef.current, ...sessionRef.current]);
  }, [uid]);

  const send = useCallback(
    async (raw, { answer, prompt } = {}) => {
      const text = String(raw || '').trim();
      if (!text || busy) return;

      Keyboard.dismiss();
      setInput('');
      stick.current = true;
      setSession((s) => [...s, { id: nextId(), role: 'user', text, local: !!answer }]);
      setThinking(true);

      try {
        let reply;
        if (answer) {
          await sleep(900 + Math.random() * 500); // looks like it is thinking, answer is already in the app
          reply = answer;
        } else {
          const [result] = await Promise.all([askKingXAI(fbUser, prompt || text, userName), sleep(700)]);
          reply = result;
        }
        setThinking(false);
        addAnswer(reply, { local: !!answer });
      } catch (e) {
        setThinking(false);
        setSession((s) => [...s, { id: nextId(), role: 'model', text: '', error: friendlyError(e), retryText: text }]);
      }
      setTimeout(persist, 50);
    },
    [busy, fbUser, userName, addAnswer, persist]
  );

  const retry = useCallback(
    (item) => {
      setSession((s) => {
        const i = s.findIndex((m) => m.id === item.id);
        const prev = i > 0 && s[i - 1].role === 'user' && s[i - 1].text === item.retryText ? i - 1 : i;
        return s.filter((_, idx) => idx !== i && idx !== prev);
      });
      setTimeout(() => send(item.retryText), 0);
    },
    [send]
  );

  const onTypingDone = useCallback((id) => {
    setTypingId((cur) => (cur === id ? null : cur));
    setDoneIds((d) => ({ ...d, [id]: true }));
    scrollEnd(true);
  }, [scrollEnd]);

  const stop = () => setSkipKey((k) => k + 1);

  const clearChat = () => {
    Alert.alert('Clear chat?', 'This deletes your saved King X AI conversation.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          try {
            await clearHistory(fbUser);
            await clearCachedHistory(uid);
            setHistory([]); historyRef.current = [];
            setSession([]); setTypingId(null); setDoneIds({});
            addAnswer(greetingFor(userName), { local: true });
          } catch (e) {
            Alert.alert('Could not clear', friendlyError(e));
          }
        },
      },
    ]);
  };

  const all = [...history, ...session];
  const canSend = input.trim().length > 0 && !busy;

  return (
    <Screen edges={['top', 'bottom']}>
      {/* header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, height: 60, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={{ padding: 6 }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <KingXAIAvatar size={38} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <T weight="bold" size={16}>King X AI</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.online }} />
            <T size={11} color="subtext">{busy ? (typingId ? 'Typing...' : 'Thinking...') : 'AI assistant'}</T>
          </View>
        </View>
        <Pressable onPress={clearChat} hitSlop={12} style={{ padding: 8 }}>
          <Ionicons name="trash-outline" size={21} color={colors.subtext} />
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingVertical: 10 }}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={32}
          onScroll={(e) => {
            const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
            stick.current = contentSize.height - (contentOffset.y + layoutMeasurement.height) < 90;
          }}
          onContentSizeChange={() => scrollEnd(false)}
        >
          {loadingHistory ? <ActivityIndicator style={{ marginTop: 20 }} color={colors.primary} /> : null}

          {all.map((item) => (
            <Message
              key={item.id}
              item={item}
              typing={item.id === typingId && !doneIds[item.id]}
              skipKey={skipKey}
              onTypingDone={onTypingDone}
              onRetry={retry}
            />
          ))}

          {thinking ? <KingXAIThinking /> : null}

          {/* ready-made messages */}
          {!hasUserMessage && !thinking ? (
            <View style={{ paddingHorizontal: 14, marginTop: 8, gap: 8 }}>
              <T size={12} color="subtext" weight="medium">Quick start</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {QUICK_PROMPTS.map((q) => (
                  <Pressable
                    key={q.id}
                    disabled={busy}
                    onPress={() => send(q.label, { answer: q.answer, prompt: q.prompt })}
                    style={({ pressed }) => ({
                      flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, height: 38, borderRadius: 19,
                      borderWidth: 1, borderColor: colors.border, backgroundColor: pressed ? colors.inputBg : colors.card, opacity: busy ? 0.5 : 1,
                    })}
                  >
                    <Ionicons name={q.icon} size={16} color={colors.primary} />
                    <T size={13} weight="medium">{q.label}</T>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>

        {/* message box */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg }}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask King X AI..."
            placeholderTextColor={colors.subtext}
            multiline
            maxLength={4000}
            onFocus={() => { stick.current = true; setTimeout(() => scrollEnd(true), 250); }}
            style={{
              flex: 1, maxHeight: 130, minHeight: 44, borderRadius: 22, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11,
              backgroundColor: colors.inputBg, color: colors.text, fontFamily: fonts.regular, fontSize: 15,
            }}
          />
          {typingId ? (
            <Pressable onPress={stop} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.inputBg, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="stop" size={18} color={colors.text} />
            </Pressable>
          ) : (
            <Pressable onPress={() => send(input)} disabled={!canSend} style={{ opacity: canSend ? 1 : 0.45 }}>
              <LinearGradient colors={['#E11D2A', '#8B0F18']} {...gradientProps} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
                {thinking ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="arrow-up" size={22} color="#fff" />}
              </LinearGradient>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
