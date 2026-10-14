import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, AppState, FlatList, Image, KeyboardAvoidingView, Modal, PanResponder,
  Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { FontAwesome } from '@expo/vector-icons';
import { collection, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';

import { db } from '../config/firebase';
import * as Notifications from 'expo-notifications';
import { decryptFrom, CANT_DECRYPT, useE2EReady, setPeerKey } from '../services/crypto';
import { setActiveChatUser } from '../services/pushTokens';
import { uploadFile, pickMedia, mimeOf } from '../services/media';
import { usePeerTyping } from '../utils/typing';
import {
  chatIdFor, deleteMessageForMe, markChatRead, markMessagesSeen, reactToMessage, removeReaction,
  sendImageMessage, sendMessage, sendVoiceMessage, setTyping, unsendMessage,
} from '../services/chat';

import VoiceRecorderBar from '../components/VoiceRecorderBar';
import VoiceMessageBubble from '../components/VoiceMessageBubble';
import TypingDots from '../components/TypingDots';
import SharedLinkCard, { parseSharedLink } from '../components/SharedLinkCard';
import LinkText from '../components/LinkText';
import ChatGalleryPicker from '../components/ChatGalleryPicker';
import ChatImageBubble from '../components/ChatImageBubble';

const RED = '#E11D2A', BG = '#080808', CARD = '#171717', BORDER = '#292929', MUTED = '#8F8F8F';
const MAX_PHOTOS = 10;
const QUICK = ['❤️', '😂', '😅', '😢', '🔥', '👍'];
const EXTRA = [
  '👎', '👏', '🙌', '😍', '🥰', '😘', '🤣', '😎', '🤔', '😮', '😱', '😡', '😭', '🥹', '🤗',
  '😴', '🤩', '💀', '🤝', '🙏', '💯', '✨', '🎉', '💔', '❤️‍🔥', '🫶', '👀', '🚀', '😈', '🍌',
];

/* ---------- small helpers ---------- */

const ms = (v) => {
  try { return v?.toMillis?.() ?? v?.toDate?.().getTime() ?? (v ? new Date(v).getTime() || 0 : 0); } catch { return 0; }
};

const seenTime = (v) => {
  const m = ms(v), d = Date.now() - m;
  if (!m || d < 6e4) return 'Seen just now';
  if (d < 36e5) return `Seen ${Math.floor(d / 6e4)}m ago`;
  if (d < 864e5) return `Seen ${Math.floor(d / 36e5)}h ago`;
  return `Seen ${new Date(m).toLocaleDateString()}`;
};

// replied-message fields can be stored under slightly different keys
const rText = (r) => String(r?.text ?? r?.message ?? r?.content ?? r?.body ?? '');
const rSender = (r) => r?.senderId ?? r?.uid ?? r?.userId ?? null;
const rName = (r) => r?.senderName ?? r?.name ?? r?.displayName ?? '';
const photoOf = (p) => p?.photoURL || p?.photoUrl || p?.profilePic || p?.avatar || '';
const nameOf = (p) => p?.displayName || p?.name || 'User';

const Avatar = ({ uri, name, size = 40 }) => (
  <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: RED, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
    {uri
      ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
      : <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.42 }}>{name.charAt(0).toUpperCase()}</Text>}
  </View>
);

const MenuItem = ({ icon, label, onPress, danger }) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress}>
    <View style={[styles.menuIcon, danger && { backgroundColor: 'rgba(225,29,42,.16)' }]}>
      <FontAwesome name={icon} size={16} color={danger ? RED : '#fff'} />
    </View>
    <Text style={[styles.menuLabel, danger && { color: RED }]}>{label}</Text>
  </TouchableOpacity>
);

/* =========================================================
   ONE MESSAGE (swipe to reply, long press for the menu)
   ========================================================= */

const MessageRow = React.memo(function MessageRow({ item, seenText, onLongPress, onReply, onReactionPress, inputRef }) {
  const mine = item.senderId === item._meId;
  const dir = mine ? -1 : 1; // your messages swipe right-to-left, friends' left-to-right
  const x = useRef(new Animated.Value(0)).current;
  const longRef = useRef(false);
  const itemRef = useRef(item); itemRef.current = item;
  const replyRef = useRef(onReply); replyRef.current = onReply;

  // built once per row, so a re-render in the middle of a swipe can't reset it
  const swipe = useMemo(() => {
    const back = () => Animated.spring(x, { toValue: 0, speed: 30, bounciness: 4, useNativeDriver: true }).start();
    const ok = (dx, dy) => Math.abs(dx) >= 8 && Math.abs(dx) > Math.abs(dy) + 5 && dx * dir > 0;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => ok(g.dx, g.dy),
      onMoveShouldSetPanResponderCapture: (_, g) => ok(g.dx, g.dy),
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderMove: (_, g) => { if (g.dx * dir > 0) x.setValue(Math.max(-90, Math.min(90, g.dx))); },
      onPanResponderRelease: (_, g) => {
        back();
        if (g.dx * dir >= 55) {
          replyRef.current(itemRef.current);
          requestAnimationFrame(() => inputRef?.current?.focus());
        }
      },
      onPanResponderTerminate: back,
    });
  }, [mine]);

  const longPress = async () => {
    if (longRef.current) return;
    longRef.current = true;
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    onLongPress(item);
    setTimeout(() => { longRef.current = false; }, 250);
  };

  const counts = {};
  Object.values(item.reactions || {}).forEach((e) => e && (counts[e] = (counts[e] || 0) + 1));

  const hasReply = !!item.replyTo && !item.unsent;
  const replyName = rSender(item.replyTo) === item._meId ? 'You' : rName(item.replyTo) || 'Message';

  const body = () => {
    if (item.unsent) return <Text style={[styles.text, styles.unsentText]}>{item.text}</Text>;
    if (item.type === 'image' && item.images?.length) {
      return (
        <View>
          <ChatImageBubble images={item.images} />
          {!!item.caption && <LinkText style={[styles.text, { marginTop: 6 }]}>{item.caption}</LinkText>}
        </View>
      );
    }
    if (item.type === 'audio' && item.audioUrl) return <VoiceMessageBubble url={item.audioUrl} duration={item.duration || 0} />;
    const link = parseSharedLink(item.text);
    return link ? <SharedLinkCard link={link} /> : <LinkText style={styles.text}>{String(item.text || '')}</LinkText>;
  };

  return (
    <View style={[styles.row, { alignItems: mine ? 'flex-end' : 'flex-start' }]}>
      <Animated.View
        {...swipe.panHandlers}
        style={{ maxWidth: '78%', flexShrink: 1, minWidth: 0, alignSelf: mine ? 'flex-end' : 'flex-start', transform: [{ translateX: x }] }}
      >
        <Pressable
          onLongPress={longPress}
          delayLongPress={300}
          style={[styles.bubble, mine ? styles.mine : styles.theirs, item.unsent && styles.unsent, hasReply && { minWidth: 230 }]}
        >
          {hasReply && (
            <View style={styles.quote}>
              <View style={styles.quoteBar} />
              <View style={styles.quoteBody}>
                <Text style={styles.quoteName} numberOfLines={1}>{replyName}</Text>
                <Text style={styles.quoteText} numberOfLines={2}>{rText(item.replyTo) || 'Message'}</Text>
              </View>
            </View>
          )}
          {body()}
          {item.unsent && <Text style={styles.unsentLabel}>Unsent message</Text>}
        </Pressable>

        {Object.keys(counts).length > 0 && (
          <View style={[styles.reactions, { justifyContent: mine ? 'flex-end' : 'flex-start' }]}>
            {Object.entries(counts).map(([e, c]) => (
              <TouchableOpacity key={e} style={styles.chip} onPress={() => onReactionPress(item, e)}>
                <Text style={{ fontSize: 15 }}>{e}</Text>
                {c > 1 && <Text style={styles.chipCount}>{c}</Text>}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </Animated.View>

      {item._pending && mine && !item.unsent && <Text style={styles.seen}>Sending…</Text>}
      {!!seenText && !item._pending && <Text style={styles.seen}>{seenText}</Text>}
    </View>
  );
});

/* =========================================================
   CHAT SCREEN
   ========================================================= */

export default function ChatScreen({ route, navigation }) {
  const { user, otherUser, friendProfiles = {} } = route.params || {};
  const me = user || {}, other = otherUser || {};
  const meId = me.id || me.uid || null;
  const otherId = other.id || other.uid || null;
  const chatId = chatIdFor(meId, otherId);
  const profile = friendProfiles?.[otherId] || other;
  const name = nameOf(profile);

  const [rawMessages, setRawMessages] = useState([]);
  const [limitN, setLimitN] = useState(40);
  const e2eReady = useE2EReady();
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [menuMessage, setMenuMessage] = useState(null);
  const [reactionMessage, setReactionMessage] = useState(null);
  const [extra, setExtra] = useState(false);
  const [forward, setForward] = useState(false);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, setPending] = useState([]);
  const [sendingPhotos, setSendingPhotos] = useState(false);
  const [peerTypingValue, setPeerTypingValue] = useState(0);
  const [peerRead, setPeerRead] = useState(0); // when the other person last read this chat
  const [tick, setTick] = useState(0); // re-renders the "Seen 2m ago" text

  const inputRef = useRef(null);
  const menuAnim = useRef(new Animated.Value(0)).current;
  const typingOn = useRef(false);
  const typingWrite = useRef(0);
  const typingTimer = useRef(null);
  const otherTyping = usePeerTyping(peerTypingValue);

  /* ---------- typing ---------- */

  const stopTyping = () => {
    clearTimeout(typingTimer.current);
    if (!typingOn.current) return;
    typingOn.current = false;
    typingWrite.current = 0;
    setTyping(chatId, meId, false).catch(() => {});
  };

  const onChangeText = (value) => {
    setText(value);
    if (!meId || !otherId) return;
    if (!value.trim()) return stopTyping();
    // refresh the timestamp every 3s so the other phone can tell "typing" from "stuck"
    if (!typingOn.current || Date.now() - typingWrite.current > 3000) {
      typingOn.current = true;
      typingWrite.current = Date.now();
      setTyping(chatId, meId, true).catch(() => {});
    }
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(stopTyping, 3500);
  };

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s !== 'active' && stopTyping());
    return () => sub.remove();
  }, [chatId, meId]);

  useEffect(() => () => {
    clearTimeout(typingTimer.current);
    if (typingOn.current && chatId && meId) setTyping(chatId, meId, false).catch(() => {});
  }, [chatId, meId]);

  useEffect(() => {
    if (!chatId || !otherId) return undefined;
    return onSnapshot(
      doc(db, 'chats', chatId),
      (s) => {
        setPeerTypingValue(s.data()?.typing?.[otherId] || 0);
        setPeerRead(ms(s.data()?.lastRead?.[otherId]));
      },
      () => {}
    );
  }, [chatId, otherId]);

  // refresh "Seen 2m ago" every 30 seconds
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  /* ---------- messages ----------
     - unchanged messages keep the same object, so the list does not re-render / flicker
     - read receipts are written only for real, server-confirmed, unseen incoming messages
       (no write -> snapshot -> write loop)                                                  */

  const sigCache = useRef(new Map());
  const seenSent = useRef(new Set());

  useEffect(() => {
    if (!meId || !otherId) { setLoading(false); return undefined; }
    sigCache.current = new Map();
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'desc'), limit(limitN));
    return onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snap) => {
        const prev = sigCache.current;
        const next = new Map();
        const list = [];

        snap.docs.forEach((d) => {
          const m = d.data();
          if ((m.deletedFor || []).includes(meId)) return;
          const pending = d.metadata.hasPendingWrites;
          const sig = [
            m.createdAt?.seconds || 0, m.enc?.n || m.text || '', m.unsent ? 1 : 0, pending ? 1 : 0,
            JSON.stringify(m.reactions || {}), Object.keys(m.seenBy || {}).filter((k) => m.seenBy[k]).join(','),
            m.replyTo?.id || '', m.audioUrl || '', (m.images || []).length,
          ].join('|');

          const old = prev.get(d.id);
          if (old && old.sig === sig) { next.set(d.id, old); list.push(old.item); return; }

          const item = { id: d.id, ...m, _pending: pending, _meId: meId, _otherId: otherId };
          next.set(d.id, { sig, item });
          list.push(item);
        });

        sigCache.current = next;
        setRawMessages((old) => (old.length === list.length && old.every((x, i) => x === list[i]) ? old : list));
        setLoading(false);

        const unseen = list.filter((m) => m.senderId !== meId && !m.seenBy?.[meId] && !m._pending && !seenSent.current.has(m.id));
        if (unseen.length && AppState.currentState === 'active') {
          unseen.forEach((m) => seenSent.current.add(m.id));
          markChatRead(chatId, meId).catch(() => {});
          markMessagesSeen(chatId, unseen, meId).catch((e) => console.log('Read/seen:', e?.message || e));
        }
      },
      (e) => { console.log('Messages:', e?.message || e); setLoading(false); }
    );
  }, [chatId, meId, otherId, limitN]);

  // load older messages when scrolling to the top
  const loadOlder = useCallback(() => {
    if (rawMessages.length >= limitN) setLimitN((n) => n + 40);
  }, [rawMessages.length, limitN]);

  // decrypt (cached per message object, so each one is only decrypted once)
  const decrypted = useRef(new WeakMap());
  const decryptedFor = useRef(false);
  const messages = useMemo(() => {
    if (decryptedFor.current !== e2eReady) { decryptedFor.current = e2eReady; decrypted.current = new WeakMap(); }
    return rawMessages.map((m) => {
      if (m.unsent || (!m.enc && !m.replyTo?.enc)) return m;
      const hit = decrypted.current.get(m);
      if (hit) return hit;

      const out = { ...m };
      if (m.enc) {
        const plain = e2eReady ? decryptFrom(m.enc, m.senderId) : null;
        const shown = plain ?? (e2eReady ? CANT_DECRYPT : '🔒 …');
        if (m.type === 'image') { out.caption = shown; out.text = shown; } else out.text = shown;
      }
      if (m.replyTo?.enc) out.replyTo = { ...m.replyTo, text: e2eReady ? decryptFrom(m.replyTo.enc, m.senderId) ?? '' : '' };
      if (e2eReady) decrypted.current.set(m, out);
      return out;
    });
  }, [rawMessages, e2eReady]);

  // keep the friend's public key fresh (used when sending)
  useEffect(() => {
    if (!otherId) return undefined;
    return onSnapshot(doc(db, 'users', otherId), (s) => setPeerKey(otherId, s.data()?.publicKey), () => {});
  }, [otherId]);

  // no banner for this chat while it is open, and clear its old notifications
  useEffect(() => {
    if (!otherId) return undefined;
    setActiveChatUser(otherId);
    Notifications.dismissAllNotificationsAsync().catch(() => {});
    return () => setActiveChatUser(null);
  }, [otherId]);

  const isSeen = (m) => m.senderId === meId && (!!m.seenBy?.[otherId] || (peerRead > 0 && ms(m.createdAt) > 0 && ms(m.createdAt) <= peerRead));
  const latestSeenMsg = useMemo(() => messages.find(isSeen) || null, [messages, peerRead, meId, otherId]);
  const seenText = latestSeenMsg ? seenTime(peerRead || latestSeenMsg.seenBy?.[otherId]) : '';

  /* ---------- action menu ---------- */

  const closeMenu = useCallback(() => {
    Animated.timing(menuAnim, { toValue: 0, duration: 80, useNativeDriver: true }).start(() => setMenuMessage(null));
  }, [menuAnim]);

  const openMenu = useCallback((m) => {
    setMenuMessage(m);
    menuAnim.setValue(0);
    requestAnimationFrame(() => Animated.timing(menuAnim, { toValue: 1, duration: 100, useNativeDriver: true }).start());
  }, [menuAnim]);

  const handleReply = useCallback((m) => {
    if (!m || m.unsent) return;
    setReplyingTo(m);
    closeMenu();
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [closeMenu]);

  const fail = (title) => (e) => Alert.alert(title, e?.message || 'Something went wrong.');

  const react = async (emoji) => {
    if (!menuMessage?.id) return;
    try { await reactToMessage(chatId, menuMessage.id, meId, emoji); setExtra(false); closeMenu(); }
    catch (e) { fail('Reaction failed')(e); }
  };

  // tapping your own reaction offers to remove it; any other reaction opens the menu
  const reactionPress = useCallback((m, emoji) => (m.reactions?.[meId] === emoji ? setReactionMessage(m) : openMenu(m)), [meId, openMenu]);

  const removeReact = async () => {
    try { await removeReaction(chatId, reactionMessage.id, meId); } catch (e) { fail('Error')(e); }
    setReactionMessage(null);
  };

  const unsend = async () => {
    const id = menuMessage?.id;
    closeMenu();
    if (id) unsendMessage(chatId, id, meId).catch(fail('Could not unsend'));
  };

  const deleteForMe = async () => {
    const id = menuMessage?.id;
    closeMenu();
    if (id) deleteMessageForMe(chatId, id, meId).catch(fail('Could not delete'));
  };

  const copy = async () => {
    try { if (menuMessage?.text) await Clipboard.setStringAsync(menuMessage.text); } catch {}
    closeMenu();
  };

  /* ---------- forward ---------- */

  const friends = Object.values(friendProfiles || {}).map((f) => ({ ...f, id: f?.id || f?.uid })).filter((f) => f.id && f.id !== meId);

  const openForward = () => {
    setSelected([]);
    closeMenu();
    setTimeout(() => setForward(true), 100);
  };

  const doForward = async () => {
    if (!menuMessage?.text) return;
    setBusy(true);
    try {
      for (const id of selected) await sendMessage(meId, id, menuMessage.text, null, { notify: { name: me.name, photo: me.photoURL } });
      setForward(false); setSelected([]); setMenuMessage(null);
    } catch (e) { fail('Forward failed')(e); }
    setBusy(false);
  };

  /* ---------- sending ---------- */

  const replyData = () => replyingTo && {
    id: replyingTo.id,
    text: rText(replyingTo),
    senderId: replyingTo.senderId,
    senderName: replyingTo.senderId === meId ? 'You' : replyingTo.senderName || name,
  };

  // pushed together with the message itself (see services/chat.js)
  const sendOpts = () => ({
    notify: { name: me.name, photo: me.photoURL },
    onError: (e) => Alert.alert('Message not sent', e?.message || 'The server rejected this message.'),
  });

  const sendFailed = (title) => (e) => {
    if (e?.code === 'E2E_NO_KEY') {
      Alert.alert('Not encrypted yet', `${name} has not opened the updated King X yet, so this cannot be end-to-end encrypted. Ask them to open the app once, then try again.`);
    } else {
      Alert.alert(title, `${e?.message || 'Something went wrong.'}${e?.code ? `\n\n(${e.code})` : ''}`);
    }
  };

  const send = async () => {
    const clean = text.trim();
    if (!clean) return;
    const reply = replyData();
    setText(''); setReplyingTo(null); stopTyping();
    try {
      // encrypts, shows the message instantly and notifies the friend at the same moment;
      // nothing here waits for the server
      await sendMessage(meId, otherId, clean, reply, sendOpts());
      requestAnimationFrame(() => inputRef.current?.focus());
    } catch (e) {
      setText(clean);
      sendFailed('Send failed')(e);
    }
  };

  const sendVoice = async (uri, duration) => {
    try {
      const url = await uploadFile(uri, `voice/${chatId}/${Date.now()}.m4a`, 'audio/m4a');
      await sendVoiceMessage(meId, otherId, url, duration, null, sendOpts());
    } catch (e) { fail('Voice message failed')(e); }
    setRecordingVoice(false);
  };

  const addPhotos = (list) => setPending((p) => [...p, ...list].slice(0, MAX_PHOTOS));

  const takePhoto = async () => {
    const photo = await pickMedia({ source: 'camera' });
    if (photo) addPhotos([photo]);
  };

  const sendPhotos = async () => {
    const files = pending, caption = text.trim(), reply = replyData();
    setPending([]); setText(''); setReplyingTo(null); stopTyping(); setSendingPhotos(true);
    try {
      const urls = await Promise.all(files.map((f, i) => uploadFile(f.uri, `chat/${chatId}/${Date.now()}_${i}.jpg`, mimeOf(f))));
      await sendImageMessage(meId, otherId, urls, caption, reply, sendOpts());
    } catch (e) {
      setPending(files); setText(caption);
      sendFailed('Photo failed')(e);
    }
    setSendingPhotos(false);
  };

  const canSend = !!text.trim() || pending.length > 0;
  const onSendPress = () => !sendingPhotos && (pending.length ? sendPhotos() : send());

  /* ---------- screen ---------- */

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.back} onPress={() => navigation?.goBack()}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
            onPress={() => otherId && navigation?.navigate('UserProfile', { userId: otherId })}
          >
            <Avatar uri={photoOf(profile)} name={name} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.headerName}>{name}</Text>
              <Text style={[styles.headerStatus, otherTyping && { color: '#22C55E' }]}>
                {otherTyping ? 'typing...' : profile?.online ? 'Online' : 'Messages'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* messages */}
        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={RED} /></View>
        ) : (
          <FlatList
            inverted
            data={messages}
            keyExtractor={(m) => m.id}
            keyboardShouldPersistTaps="handled"
            extraData={`${tick}-${peerRead}`}
            onEndReached={loadOlder}
            onEndReachedThreshold={0.4}
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={9}
            removeClippedSubviews={false}
            contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 14 }}
            renderItem={({ item }) => (
              <MessageRow
                item={item}
                seenText={item.id === latestSeenMsg?.id ? seenText : ''}
                onLongPress={openMenu}
                onReply={handleReply}
                onReactionPress={reactionPress}
                inputRef={inputRef}
              />
            )}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingTop: 250 }}>
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>No messages yet</Text>
                <Text style={{ color: '#777', marginTop: 5 }}>Start the conversation 👋</Text>
              </View>
            }
          />
        )}

        {otherTyping && !recordingVoice && <TypingDots name={name.split(' ')[0]} />}

        {/* reply banner */}
        {replyingTo && (
          <View style={styles.replyBar}>
            <View style={{ width: 4, height: 44, backgroundColor: RED }} />
            <View style={{ flex: 1, minWidth: 0, padding: 8 }}>
              <Text style={{ color: RED, fontWeight: '800', fontSize: 12 }}>
                Replying to {replyingTo.senderId === meId ? 'yourself' : replyingTo.senderName || name}
              </Text>
              <Text style={{ color: '#AAA', fontSize: 12 }} numberOfLines={2}>{rText(replyingTo) || 'Message'}</Text>
            </View>
            <TouchableOpacity onPress={() => setReplyingTo(null)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesome name="times" size={20} color="#999" />
            </TouchableOpacity>
          </View>
        )}

        {/* message box: camera | text | mic | send */}
        {recordingVoice ? (
          <VoiceRecorderBar onCancel={() => setRecordingVoice(false)} onSend={sendVoice} />
        ) : (
          <View>
            {pending.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip} contentContainerStyle={{ padding: 8 }}>
                {pending.map((p, i) => (
                  <View key={p.uri + i} style={{ marginRight: 8 }}>
                    <Image source={{ uri: p.uri }} style={{ width: 64, height: 64, borderRadius: 10 }} />
                    <TouchableOpacity style={styles.stripX} onPress={() => setPending((x) => x.filter((_, j) => j !== i))}>
                      <Text style={{ color: '#fff', fontSize: 15, lineHeight: 17, fontWeight: '800' }}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            <View style={styles.composer}>
              <TouchableOpacity style={styles.round} onPress={() => setPickerOpen(true)}>
                <FontAwesome name="camera" size={19} color="#fff" />
              </TouchableOpacity>

              <TextInput
                ref={inputRef}
                value={text}
                onChangeText={onChangeText}
                placeholder={pending.length ? 'Add a caption...' : 'Message...'}
                placeholderTextColor="#666"
                multiline
                maxLength={4000}
                style={styles.input}
              />

              <TouchableOpacity style={styles.round} onPress={() => setRecordingVoice(true)}>
                <FontAwesome name="microphone" size={21} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity style={[styles.round, styles.sendBtn, !canSend && { opacity: 0.45 }]} disabled={!canSend} onPress={onSendPress}>
                {sendingPhotos ? <ActivityIndicator color="#fff" /> : <FontAwesome name="send" size={18} color="#fff" />}
              </TouchableOpacity>
            </View>
          </View>
        )}

        <ChatGalleryPicker
          visible={pickerOpen}
          max={MAX_PHOTOS - pending.length}
          onClose={() => setPickerOpen(false)}
          onDone={(list) => { setPickerOpen(false); addPhotos(list); }}
          onOpenCamera={() => setTimeout(takePhoto, 300)}
        />

        {/* long-press menu */}
        <Modal visible={!!menuMessage} transparent animationType="none" onRequestClose={closeMenu}>
          <View style={styles.backdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeMenu} />
            <Animated.View
              style={[styles.sheet, {
                opacity: menuAnim,
                transform: [{ translateY: menuAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
              }]}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'center', paddingVertical: 5 }}>
                {QUICK.map((e) => (
                  <TouchableOpacity key={e} style={styles.quick} onPress={() => react(e)}>
                    <Text style={{ fontSize: 25 }}>{e}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={[styles.quick, { backgroundColor: RED, borderColor: RED }]} onPress={() => setExtra(true)}>
                  <FontAwesome name="plus" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={{ height: 1, backgroundColor: BORDER, marginVertical: 8 }} />
              <MenuItem icon="reply" label="Reply" onPress={() => handleReply(menuMessage)} />
              <MenuItem icon="share" label="Forward" onPress={openForward} />
              <MenuItem icon="copy" label="Copy" onPress={copy} />
              {menuMessage?.senderId === meId && !menuMessage?.unsent && <MenuItem icon="undo" label="Unsend" danger onPress={unsend} />}
              <MenuItem icon="trash" label="Delete for you" danger onPress={deleteForMe} />
              <MenuItem icon="times" label="Cancel" onPress={closeMenu} />
            </Animated.View>
          </View>
        </Modal>

        {/* more reactions */}
        <Modal visible={extra} transparent animationType="slide" onRequestClose={() => setExtra(false)}>
          <View style={styles.backdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setExtra(false)} />
            <View style={[styles.sheet, { maxHeight: '70%', padding: 15 }]}>
              <View style={styles.handle} />
              <Text style={styles.sheetTitle}>Choose reaction</Text>
              <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
                {EXTRA.map((e) => (
                  <TouchableOpacity key={e} style={styles.emoji} onPress={() => react(e)}>
                    <Text style={{ fontSize: 28 }}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* remove my reaction */}
        <Modal visible={!!reactionMessage} transparent animationType="fade" onRequestClose={() => setReactionMessage(null)}>
          <View style={[styles.backdrop, { justifyContent: 'center' }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setReactionMessage(null)} />
            <View style={styles.popup}>
              <Text style={{ fontSize: 40 }}>{reactionMessage?.reactions?.[meId]}</Text>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginVertical: 18 }}>Remove your reaction?</Text>
              <TouchableOpacity style={styles.bigBtn} onPress={removeReact}>
                <Text style={{ color: '#fff', fontWeight: '800' }}>Remove</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ height: 48, justifyContent: 'center' }} onPress={() => setReactionMessage(null)}>
                <Text style={{ color: '#999' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* forward */}
        <Modal visible={forward} transparent animationType="slide" onRequestClose={() => setForward(false)}>
          <View style={styles.backdrop}>
            <View style={[styles.sheet, { maxHeight: '82%', padding: 15 }]}>
              <View style={styles.handle} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.sheetTitle}>Forward to</Text>
                <TouchableOpacity onPress={() => setForward(false)}><FontAwesome name="times" size={22} color="#999" /></TouchableOpacity>
              </View>

              {!friends.length ? (
                <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center', paddingVertical: 50 }}>No friends available</Text>
              ) : (
                <ScrollView style={{ maxHeight: 440 }}>
                  {friends.map((f) => {
                    const on = selected.includes(f.id);
                    return (
                      <TouchableOpacity
                        key={f.id}
                        style={styles.friendRow}
                        onPress={() => setSelected((s) => (on ? s.filter((v) => v !== f.id) : [...s, f.id]))}
                      >
                        <Avatar uri={photoOf(f)} name={nameOf(f)} size={44} />
                        <View style={{ flex: 1, marginLeft: 11, minWidth: 0 }}>
                          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{nameOf(f)}</Text>
                          <Text style={{ color: '#777', fontSize: 12 }}>{f.username ? `@${f.username}` : 'Friend'}</Text>
                        </View>
                        <View style={[styles.check, on && { backgroundColor: RED, borderColor: RED }]}>
                          {on && <FontAwesome name="check" size={12} color="#fff" />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              <TouchableOpacity
                style={[styles.bigBtn, { height: 50, marginTop: 12 }, (!selected.length || busy) && { opacity: 0.45 }]}
                disabled={!selected.length || busy}
                onPress={doForward}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>Forward{selected.length ? ` (${selected.length})` : ''}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* =========================================================
   STYLES
   ========================================================= */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: BORDER, backgroundColor: '#0C0C0C' },
  back: { width: 38, height: 42, justifyContent: 'center', alignItems: 'center' },
  backText: { color: '#fff', fontSize: 38, fontWeight: '300' },
  headerName: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  headerStatus: { color: MUTED, fontSize: 12, marginTop: 2 },

  row: { width: '100%', marginVertical: 4 },
  bubble: { maxWidth: '100%', minWidth: 50, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 9, alignSelf: 'stretch' },
  mine: { backgroundColor: RED, borderBottomRightRadius: 5 },
  theirs: { backgroundColor: CARD, borderBottomLeftRadius: 5, borderWidth: 1, borderColor: BORDER },
  unsent: { backgroundColor: '#444', opacity: 0.75 },
  text: { color: '#fff', fontSize: 15, lineHeight: 21, flexShrink: 1, maxWidth: '100%' },
  unsentText: { color: '#D0D0D0', fontStyle: 'italic' },
  unsentLabel: { color: '#AAA', fontSize: 10, marginTop: 3, fontStyle: 'italic' },
  seen: { color: '#777', fontSize: 10, marginTop: 3, marginHorizontal: 4, alignSelf: 'flex-end' },

  quote: { width: '100%', minHeight: 42, maxHeight: 84, flexDirection: 'row', backgroundColor: '#350B10', borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#61151C', overflow: 'hidden' },
  quoteBar: { width: 4, flexShrink: 0, backgroundColor: RED },
  quoteBody: { flex: 1, minWidth: 0, paddingHorizontal: 9, paddingVertical: 6, justifyContent: 'center' },
  quoteName: { color: '#FF5962', fontSize: 11, lineHeight: 14, fontWeight: '900', marginBottom: 2 },
  quoteText: { color: '#D6A6AA', fontSize: 12, lineHeight: 16 },

  reactions: { flexDirection: 'row', marginTop: -4 },
  chip: { minHeight: 27, paddingHorizontal: 7, borderRadius: 15, backgroundColor: '#202020', borderWidth: 1, borderColor: '#333', flexDirection: 'row', alignItems: 'center', marginRight: 4 },
  chipCount: { color: '#fff', fontSize: 11, marginLeft: 3, fontWeight: '700' },

  replyBar: { minHeight: 62, maxHeight: 82, backgroundColor: '#101010', borderTopWidth: 1, borderTopColor: BORDER, flexDirection: 'row', alignItems: 'center' },

  strip: { backgroundColor: '#101010', borderTopWidth: 1, borderTopColor: BORDER },
  stripX: { position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: RED, justifyContent: 'center', alignItems: 'center' },

  composer: { minHeight: 64, padding: 8, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'flex-end', backgroundColor: '#0C0C0C', borderTopWidth: 1, borderTopColor: BORDER },
  input: { flex: 1, maxHeight: 120, minHeight: 46, backgroundColor: CARD, color: '#fff', borderRadius: 23, paddingHorizontal: 17, paddingTop: 12, paddingBottom: 10, fontSize: 15, borderWidth: 1, borderColor: BORDER },
  round: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#222', marginHorizontal: 4, justifyContent: 'center', alignItems: 'center' },
  sendBtn: { backgroundColor: RED },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.72)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#151515', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 12 },
  handle: { width: 42, height: 4, borderRadius: 3, backgroundColor: '#555', alignSelf: 'center', marginBottom: 13 },
  sheetTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 12 },
  quick: { width: 49, height: 49, borderRadius: 25, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center', marginHorizontal: 4, borderWidth: 1, borderColor: '#333' },
  emoji: { width: 56, height: 56, justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: '#202020', margin: 4 },
  menuItem: { minHeight: 50, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  menuIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#252525', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  menuLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },

  popup: { alignSelf: 'center', width: '84%', backgroundColor: '#161616', borderRadius: 22, padding: 22, alignItems: 'center', borderWidth: 1, borderColor: BORDER, },
  bigBtn: { width: '100%', height: 48, borderRadius: 12, backgroundColor: RED, justifyContent: 'center', alignItems: 'center' },

  friendRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#222' },
  check: { width: 25, height: 25, borderRadius: 13, borderWidth: 2, borderColor: '#555', justifyContent: 'center', alignItems: 'center' },
});