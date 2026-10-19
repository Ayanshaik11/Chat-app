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
  sendGifMessage, sendImageMessage, sendMessage, sendVoiceMessage, setChatTheme, setTyping, unsendMessage,
} from '../services/chat';
import { DEFAULT_THEME_ID, getTheme, resolveThemeId } from '../utils/chatTheme';
import { useChatTheme } from '../context/ChatThemeContext';
import { useAuth } from '../context/AuthContext';
import { ensureWallpaperUrls } from '../services/wallpaperUrlStore';
import useReducedMotion from '../hooks/useReducedMotion';

import VoiceRecorderBar from '../components/VoiceRecorderBar';
import VoiceMessageBubble from '../components/VoiceMessageBubble';
import TypingDots from '../components/TypingDots';
import SharedLinkCard, { parseSharedLink } from '../components/SharedLinkCard';
import LinkText from '../components/LinkText';
import ChatGalleryPicker from '../components/ChatGalleryPicker';
import ChatImageBubble from '../components/ChatImageBubble';
import GifBubble from '../components/GifBubble';
import GifPicker from '../components/GifPicker';
import ChatMenu from '../components/ChatMenu';
import ChatWallpaper from '../components/ChatWallpaper';

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

const MenuItem = ({ icon, label, onPress, danger, theme }) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress}>
    <View style={[styles.menuIcon, { backgroundColor: theme?.inputBackgroundColor || '#252525' }, danger && { backgroundColor: 'rgba(225,29,42,.16)' }]}>
      <FontAwesome name={icon} size={16} color={danger ? '#FF6B75' : (theme?.iconColor || '#fff')} />
    </View>
    <Text style={[styles.menuLabel, { color: theme?.incomingTextColor || '#fff' }, danger && { color: '#FF6B75' }]}>{label}</Text>
  </TouchableOpacity>
);

/* =========================================================
   ONE MESSAGE (swipe to reply, long press for the menu)
   ========================================================= */

const MessageRow = React.memo(function MessageRow({ item, seenText, dateLabel, theme, onLongPress, onReply, onReactionPress, inputRef }) {
  const mine = item.senderId === item._meId;
  const bubbleText = mine ? theme.outgoingTextColor : theme.incomingTextColor;
  const tc = { color: bubbleText }; // text colour that is readable on this bubble
  const linkColor = mine ? theme.outgoingTextColor : theme.linkColor;
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
    if (item.unsent) return <Text style={[styles.text, tc, styles.unsentText]}>{item.text}</Text>;
    if (item.type === 'gif' && item.gifUrl) {
      return (
        <View>
          <GifBubble url={item.gifUrl} w={item.gifW} h={item.gifH} theme={theme} />
          {!!item.caption && <LinkText linkStyle={{ color: linkColor }} style={[styles.text, tc, { marginTop: 6 }]}>{item.caption}</LinkText>}
        </View>
      );
    }
    if (item.type === 'image' && item.images?.length) {
      return (
        <View>
          <ChatImageBubble images={item.images} theme={theme} />
          {!!item.caption && <LinkText linkStyle={{ color: linkColor }} style={[styles.text, tc, { marginTop: 6 }]}>{item.caption}</LinkText>}
        </View>
      );
    }
    if (item.type === 'audio' && item.audioUrl) return <VoiceMessageBubble url={item.audioUrl} duration={item.duration || 0} theme={theme} mine={mine} />;
    const link = parseSharedLink(item.text);
    return link ? <SharedLinkCard link={link} textColor={bubbleText} /> : <LinkText linkStyle={{ color: linkColor }} style={[styles.text, tc]}>{String(item.text || '')}</LinkText>;
  };

  return (
    <View style={[styles.row, { alignItems: mine ? 'flex-end' : 'flex-start' }]}>
      {!!dateLabel && (
        <View style={styles.dateRow}>
          <View style={[styles.dateChip, { backgroundColor: theme.elevated, borderColor: theme.borderColor }]}>
            <Text style={[styles.dateText, { color: theme.timestampColor }]}>{dateLabel}</Text>
          </View>
        </View>
      )}

      <Animated.View
        {...swipe.panHandlers}
        style={{ maxWidth: '78%', flexShrink: 1, minWidth: 0, alignSelf: mine ? 'flex-end' : 'flex-start', transform: [{ translateX: x }] }}
      >
        <Pressable
          onLongPress={longPress}
          delayLongPress={300}
          style={[
            styles.bubble,
            mine
              ? { backgroundColor: theme.outgoingBubbleColor }
              : { backgroundColor: theme.incomingBubbleColor, borderWidth: 1, borderColor: theme.borderColor },
            item.unsent && styles.unsent,
            hasReply && { minWidth: 230 },
          ]}
        >
          {hasReply && (
            <View style={[styles.quote, { backgroundColor: theme.replyPreviewColor, borderColor: theme.borderColor }]}>
              <View style={[styles.quoteBar, { backgroundColor: theme.accentColor }]} />
              <View style={styles.quoteBody}>
                <Text style={[styles.quoteName, { color: theme.accentColor }]} numberOfLines={1}>{replyName}</Text>
                <Text style={[styles.quoteText, { color: theme.replyText }]} numberOfLines={2}>{rText(item.replyTo) || 'Message'}</Text>
              </View>
            </View>
          )}
          {body()}
          {item.unsent && <Text style={[styles.unsentLabel, { color: theme.timestampColor }]}>Unsent message</Text>}
        </Pressable>

        {Object.keys(counts).length > 0 && (
          <View style={[styles.reactions, { justifyContent: mine ? 'flex-end' : 'flex-start' }]}>
            {Object.entries(counts).map(([e, c]) => (
              <TouchableOpacity
                key={e}
                style={[styles.chip, { backgroundColor: theme.inputBackgroundColor, borderColor: theme.borderColor }]}
                onPress={() => onReactionPress(item, e)}
              >
                <Text style={{ fontSize: 15 }}>{e}</Text>
                {c > 1 && <Text style={[styles.chipCount, { color: theme.incomingTextColor }]}>{c}</Text>}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </Animated.View>

      {item._pending && mine && !item.unsent && <Text style={[styles.seen, { color: theme.timestampColor }]}>Sending…</Text>}
      {!!seenText && !item._pending && <Text style={[styles.seen, { color: theme.timestampColor }]}>{seenText}</Text>}
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
  const [gifOpen, setGifOpen] = useState(false);
  const [pending, setPending] = useState([]);
  const [sendingPhotos, setSendingPhotos] = useState(false);
  const [peerTypingValue, setPeerTypingValue] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [peerRead, setPeerRead] = useState(0); // when the other person last read this chat
  const [tick, setTick] = useState(0); // re-renders the "Seen 2m ago" text

  /*
   * Wallpaper / theme.
   * `activeThemeId` is the shared theme from the chat document (or the value the
   * user just applied, set optimistically), and falls back to the per-chat local
   * cache while Firestore loads. Held in a context so it survives navigation.
   */
  const { themeIdFor, applyTheme } = useChatTheme();
  const { fbUser } = useAuth();
  const reducedMotion = useReducedMotion();
  const [activeThemeId, setActiveThemeId] = useState(null);
  const localThemeId = themeIdFor(chatId);
  const themeId = activeThemeId ?? localThemeId;
  const theme = useMemo(() => getTheme(themeId), [themeId]);

  useEffect(() => {
    setActiveThemeId(null);
  }, [chatId]);

  /*
   * Signed wallpaper URLs are shared app-wide and cached in memory. Fetch them
   * once per session (and re-check when returning to the foreground); the store
   * de-duplicates requests and refreshes again before the URLs expire.
   */
  useEffect(() => {
    if (!fbUser) return undefined;
    ensureWallpaperUrls(fbUser);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') ensureWallpaperUrls(fbUser);
    });
    return () => sub.remove();
  }, [fbUser]);

  const onApplyTheme = useCallback(
    async (id) => {
      if (!id) return;
      setActiveThemeId(id);
      await applyTheme(chatId, id);
      await setChatTheme(chatId, id, meId).catch(() => {});
    },
    [chatId, meId, applyTheme]
  );

  const onResetTheme = useCallback(async () => {
    setActiveThemeId(DEFAULT_THEME_ID);
    await applyTheme(chatId, DEFAULT_THEME_ID);
    await setChatTheme(chatId, DEFAULT_THEME_ID, meId).catch(() => {});
  }, [chatId, meId, applyTheme]);

  /* subtle, optional send-button glow (static unless a theme asks to pulse) */
  const glowEnabled = !!theme.glowColor && !!theme.specialEffect;
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!glowEnabled || reducedMotion || theme.specialEffect !== 'pulse') {
      glow.setValue(glowEnabled ? 0.22 : 0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 0.45, duration: 1400, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.14, duration: 1400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [glowEnabled, theme.specialEffect, reducedMotion, glow]);

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
        const remoteTheme = s.data()?.theme ? resolveThemeId(s.data().theme) : null;
        setActiveThemeId((current) => (current && !remoteTheme ? current : remoteTheme)); // shared theme for both people
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
            m.replyTo?.id || '', m.audioUrl || '', (m.images || []).length, m.gifUrl || '',
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

  /*
   * Date separators. The list is inverted (newest first), so a day chip belongs
   * above the oldest message of that day — i.e. when the next (older) message is
   * from a different day, or there is no older message.
   */
  const dateLabels = useMemo(() => {
    const map = new Map();
    const dayKey = (v) => {
      const m = ms(v);
      if (!m) return '';
      const d = new Date(m);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    };
    const sameDay = (a, b) =>
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    const labelFor = (v) => {
      const m = ms(v);
      if (!m) return '';
      const d = new Date(m);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      if (sameDay(d, today)) return 'Today';
      if (sameDay(d, yesterday)) return 'Yesterday';
      return d.toLocaleDateString(undefined, d.getFullYear() === today.getFullYear()
        ? { month: 'short', day: 'numeric' }
        : { month: 'short', day: 'numeric', year: 'numeric' });
    };
    for (let i = 0; i < messages.length; i += 1) {
      const older = messages[i + 1];
      if (!older || dayKey(messages[i].createdAt) !== dayKey(older.createdAt)) {
        map.set(messages[i].id, labelFor(messages[i].createdAt));
      }
    }
    return map;
  }, [messages]);

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
    const value = menuMessage?.type === 'gif' && menuMessage.gifUrl ? menuMessage.gifUrl : menuMessage?.text;
    try { if (value) await Clipboard.setStringAsync(value); } catch {}
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
    if (!menuMessage) return;
    setBusy(true);
    try {
      for (const id of selected) {
        const notify = { name: me.name, photo: me.photoURL };
        if (menuMessage.type === 'gif' && menuMessage.gifUrl) {
          await sendGifMessage(meId, id, { url: menuMessage.gifUrl, w: menuMessage.gifW, h: menuMessage.gifH }, null, { notify });
        } else if (menuMessage.text) {
          await sendMessage(meId, id, menuMessage.text, null, { notify });
        }
      }
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

  const sendGif = async (gif) => {
    setGifOpen(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const reply = replyData();
    setReplyingTo(null);
    try {
      await sendGifMessage(meId, otherId, gif, reply, sendOpts());
    } catch (e) { sendFailed('GIF failed')(e); }
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
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.backgroundColor }]}>
      <KeyboardAvoidingView style={[styles.safe, { backgroundColor: theme.backgroundColor }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* wallpaper layer, behind header, messages and composer (never blocks touches) */}
        <ChatWallpaper theme={theme} />

        {/* header */}
        <View style={[styles.header, { backgroundColor: theme.header, borderBottomColor: theme.borderColor }]}>
          <TouchableOpacity style={styles.back} onPress={() => navigation?.goBack()}>
            <Text style={[styles.backText, { color: theme.headerTextColor }]}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
            onPress={() => otherId && navigation?.navigate('UserProfile', { userId: otherId })}
          >
            <Avatar uri={photoOf(profile)} name={name} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.headerName, { color: theme.headerTextColor }]}>{name}</Text>
              <Text style={[styles.headerStatus, { color: theme.timestampColor }, otherTyping && { color: theme.statusColor }]}>
                {otherTyping ? 'typing...' : profile?.online ? 'Online' : 'Messages'}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMenuOpen(true)} hitSlop={10} style={{ width: 40, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome name="ellipsis-v" size={21} color={theme.iconColor || theme.headerTextColor} />
          </TouchableOpacity>
        </View>

        {/* messages */}
        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={theme.accentColor} /></View>
        ) : (
          <FlatList
            inverted
            data={messages}
            keyExtractor={(m) => m.id}
            keyboardShouldPersistTaps="handled"
            extraData={`${tick}-${peerRead}-${themeId}`}
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
                dateLabel={dateLabels.get(item.id)}
                theme={theme}
                onLongPress={openMenu}
                onReply={handleReply}
                onReactionPress={reactionPress}
                inputRef={inputRef}
              />
            )}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingTop: 250 }}>
                <Text style={{ color: theme.incomingTextColor, fontSize: 18, fontWeight: '700' }}>No messages yet</Text>
                <Text style={{ color: theme.timestampColor, marginTop: 5 }}>Start the conversation 👋</Text>
              </View>
            }
          />
        )}

        {otherTyping && !recordingVoice && <TypingDots name={name.split(' ')[0]} theme={theme} />}

        {/* reply banner */}
        {replyingTo && (
          <View style={[styles.replyBar, { backgroundColor: theme.header, borderTopColor: theme.borderColor }]}>
            <View style={{ width: 4, height: 44, backgroundColor: theme.accentColor }} />
            <View style={{ flex: 1, minWidth: 0, padding: 8 }}>
              <Text style={{ color: theme.accentColor, fontWeight: '800', fontSize: 12 }}>
                Replying to {replyingTo.senderId === meId ? 'yourself' : replyingTo.senderName || name}
              </Text>
              <Text style={{ color: theme.timestampColor, fontSize: 12 }} numberOfLines={2}>{rText(replyingTo) || 'Message'}</Text>
            </View>
            <TouchableOpacity onPress={() => setReplyingTo(null)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesome name="times" size={20} color={theme.timestampColor} />
            </TouchableOpacity>
          </View>
        )}

        {/* message box: camera | text | GIF | mic/send */}
        {recordingVoice ? (
          <VoiceRecorderBar theme={theme} onCancel={() => setRecordingVoice(false)} onSend={sendVoice} />
        ) : (
          <View>
            {pending.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.strip, { backgroundColor: theme.header, borderTopColor: theme.borderColor }]} contentContainerStyle={{ padding: 8 }}>
                {pending.map((p, i) => (
                  <View key={p.uri + i} style={{ marginRight: 8 }}>
                    <Image source={{ uri: p.uri }} style={{ width: 64, height: 64, borderRadius: 10 }} />
                    <TouchableOpacity style={[styles.stripX, { backgroundColor: theme.accentColor }]} onPress={() => setPending((x) => x.filter((_, j) => j !== i))}>
                      <Text style={{ color: theme.accentText, fontSize: 15, lineHeight: 17, fontWeight: '800' }}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            <View style={[styles.composer, { backgroundColor: theme.header, borderTopColor: theme.borderColor }]}>
              <TouchableOpacity style={[styles.round, { backgroundColor: theme.inputBackgroundColor }]} onPress={() => setPickerOpen(true)}>
                <FontAwesome name="camera" size={19} color={theme.iconColor} />
              </TouchableOpacity>

              <TextInput
                ref={inputRef}
                value={text}
                onChangeText={onChangeText}
                placeholder={pending.length ? 'Add a caption...' : 'Message...'}
                placeholderTextColor={theme.placeholderColor}
                multiline
                maxLength={4000}
                style={[styles.input, { backgroundColor: theme.inputBackgroundColor, borderColor: theme.borderColor, color: theme.inputTextColor }]}
              />

              <TouchableOpacity style={[styles.round, { backgroundColor: theme.inputBackgroundColor }]} onPress={() => setGifOpen(true)}>
                <Text style={[styles.gifLabel, { color: theme.iconColor }]}>GIF</Text>
              </TouchableOpacity>

              {canSend ? (
                <View>
                  {glowEnabled && (
                    <Animated.View
                      pointerEvents="none"
                      style={{
                        position: 'absolute',
                        top: -5,
                        left: -5,
                        right: -5,
                        bottom: -5,
                        borderRadius: 28,
                        backgroundColor: theme.glowColor,
                        opacity: glow,
                      }}
                    />
                  )}
                  <TouchableOpacity
                    style={[styles.round, { backgroundColor: theme.sendButtonColor }]}
                    disabled={sendingPhotos}
                    onPress={onSendPress}
                  >
                    {sendingPhotos ? <ActivityIndicator color={theme.sendText} /> : <FontAwesome name="send" size={18} color={theme.sendText} />}
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={[styles.round, { backgroundColor: theme.inputBackgroundColor }]} onPress={() => setRecordingVoice(true)}>
                  <FontAwesome name="microphone" size={21} color={theme.iconColor} />
                </TouchableOpacity>
              )}
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

        <GifPicker visible={gifOpen} onClose={() => setGifOpen(false)} onPick={sendGif} />

        {/* long-press menu */}
        <Modal visible={!!menuMessage} transparent animationType="none" onRequestClose={closeMenu}>
          <View style={styles.backdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeMenu} />
            <Animated.View
              style={[styles.sheet, {
                backgroundColor: theme.elevated,
                opacity: menuAnim,
                transform: [{ translateY: menuAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
              }]}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'center', paddingVertical: 5 }}>
                {QUICK.map((e) => (
                  <TouchableOpacity key={e} style={[styles.quick, { backgroundColor: theme.inputBackgroundColor, borderColor: theme.borderColor }]} onPress={() => react(e)}>
                    <Text style={{ fontSize: 25 }}>{e}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={[styles.quick, { backgroundColor: theme.accentColor, borderColor: theme.accentColor }]} onPress={() => setExtra(true)}>
                  <FontAwesome name="plus" size={20} color={theme.accentText} />
                </TouchableOpacity>
              </View>
              <View style={{ height: 1, backgroundColor: theme.borderColor, marginVertical: 8 }} />
              <MenuItem theme={theme} icon="reply" label="Reply" onPress={() => handleReply(menuMessage)} />
              <MenuItem theme={theme} icon="share" label="Forward" onPress={openForward} />
              <MenuItem theme={theme} icon="copy" label="Copy" onPress={copy} />
              {menuMessage?.senderId === meId && !menuMessage?.unsent && <MenuItem theme={theme} icon="undo" label="Unsend" danger onPress={unsend} />}
              <MenuItem theme={theme} icon="trash" label="Delete for you" danger onPress={deleteForMe} />
              <MenuItem theme={theme} icon="times" label="Cancel" onPress={closeMenu} />
            </Animated.View>
          </View>
        </Modal>

        {/* more reactions */}
        <Modal visible={extra} transparent animationType="slide" onRequestClose={() => setExtra(false)}>
          <View style={styles.backdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setExtra(false)} />
            <View style={[styles.sheet, { maxHeight: '70%', padding: 15, backgroundColor: theme.elevated }]}>
              <View style={[styles.handle, { backgroundColor: theme.borderColor }]} />
              <Text style={[styles.sheetTitle, { color: theme.incomingTextColor }]}>Choose reaction</Text>
              <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
                {EXTRA.map((e) => (
                  <TouchableOpacity key={e} style={[styles.emoji, { backgroundColor: theme.inputBackgroundColor }]} onPress={() => react(e)}>
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
            <View style={[styles.popup, { backgroundColor: theme.elevated, borderColor: theme.borderColor }]}>
              <Text style={{ fontSize: 40 }}>{reactionMessage?.reactions?.[meId]}</Text>
              <Text style={{ color: theme.incomingTextColor, fontSize: 16, fontWeight: '700', marginVertical: 18 }}>Remove your reaction?</Text>
              <TouchableOpacity style={[styles.bigBtn, { backgroundColor: theme.accentColor }]} onPress={removeReact}>
                <Text style={{ color: theme.accentText, fontWeight: '800' }}>Remove</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ height: 48, justifyContent: 'center' }} onPress={() => setReactionMessage(null)}>
                <Text style={{ color: theme.timestampColor }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* forward */}
        <Modal visible={forward} transparent animationType="slide" onRequestClose={() => setForward(false)}>
          <View style={styles.backdrop}>
            <View style={[styles.sheet, { maxHeight: '82%', padding: 15, backgroundColor: theme.elevated }]}>
              <View style={[styles.handle, { backgroundColor: theme.borderColor }]} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[styles.sheetTitle, { color: theme.incomingTextColor }]}>Forward to</Text>
                <TouchableOpacity onPress={() => setForward(false)}><FontAwesome name="times" size={22} color={theme.timestampColor} /></TouchableOpacity>
              </View>

              {!friends.length ? (
                <Text style={{ color: theme.incomingTextColor, fontWeight: '700', textAlign: 'center', paddingVertical: 50 }}>No friends available</Text>
              ) : (
                <ScrollView style={{ maxHeight: 440 }}>
                  {friends.map((f) => {
                    const on = selected.includes(f.id);
                    return (
                      <TouchableOpacity
                        key={f.id}
                        style={[styles.friendRow, { borderBottomColor: theme.borderColor }]}
                        onPress={() => setSelected((s) => (on ? s.filter((v) => v !== f.id) : [...s, f.id]))}
                      >
                        <Avatar uri={photoOf(f)} name={nameOf(f)} size={44} />
                        <View style={{ flex: 1, marginLeft: 11, minWidth: 0 }}>
                          <Text style={{ color: theme.incomingTextColor, fontSize: 15, fontWeight: '700' }}>{nameOf(f)}</Text>
                          <Text style={{ color: theme.timestampColor, fontSize: 12 }}>{f.username ? `@${f.username}` : 'Friend'}</Text>
                        </View>
                        <View style={[styles.check, { borderColor: theme.borderColor }, on && { backgroundColor: theme.accentColor, borderColor: theme.accentColor }]}>
                          {on && <FontAwesome name="check" size={12} color={theme.accentText} />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              <TouchableOpacity
                style={[styles.bigBtn, { height: 50, marginTop: 12, backgroundColor: theme.accentColor }, (!selected.length || busy) && { opacity: 0.45 }]}
                disabled={!selected.length || busy}
                onPress={doForward}
              >
                {busy ? <ActivityIndicator color={theme.accentText} /> : <Text style={{ color: theme.accentText, fontWeight: '800' }}>Forward{selected.length ? ` (${selected.length})` : ''}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <ChatMenu
          visible={menuOpen}
          onClose={() => setMenuOpen(false)}
          themeId={themeId}
          theme={theme}
          name={name.split(' ')[0]}
          onApplyTheme={onApplyTheme}
          onResetTheme={onResetTheme}
        />

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
  dateRow: { width: '100%', alignItems: 'center', marginTop: 8, marginBottom: 6 },
  dateChip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 11, borderWidth: 1 },
  dateText: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.2 },
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
  gifLabel: { color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },

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