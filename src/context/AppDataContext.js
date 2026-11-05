import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { chunk } from '../utils/helpers';
import { chatIdFor, unreadFor } from '../services/chat';
import { useAuth } from './AuthContext';
import { useSettings } from './SettingsContext';

const AppDataContext = createContext(null);
const noop = () => {};

// Live data used by many screens: friends, requests, notifications, chats
export function AppDataProvider({ children }) {
  const { me } = useAuth();
  const { vibrate } = useSettings();
  const vibrateRef = useRef(vibrate);
  vibrateRef.current = vibrate;
  const meId = me?.id;

  const [friendIds, setFriendIds] = useState([]);
  const [friendProfiles, setFriendProfiles] = useState({});
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [chats, setChats] = useState({});
  const [chatsFallback, setChatsFallback] = useState(false); // true when the all-chats query is refused by Firestore

  useEffect(() => {
    if (!meId) {
      setFriendIds([]); setFriendProfiles({}); setIncoming([]); setOutgoing([]); setNotifications([]); setChats({});
      return undefined;
    }
    const unsubs = [];
    unsubs.push(
      onSnapshot(
        query(collection(db, 'friendships'), where('members', 'array-contains', meId)),
        (snap) => setFriendIds(snap.docs.map((d) => d.data().members.find((m) => m !== meId)).filter(Boolean)),
        noop
      )
    );
    unsubs.push(
      onSnapshot(
        query(collection(db, 'requests'), where('to', '==', meId)),
        (snap) => setIncoming(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        noop
      )
    );
    unsubs.push(
      onSnapshot(
        query(collection(db, 'requests'), where('from', '==', meId)),
        (snap) => setOutgoing(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        noop
      )
    );

    let firstN = true;
    unsubs.push(
      onSnapshot(
        query(collection(db, 'users', meId, 'notifications'), orderBy('createdAt', 'desc'), limit(100)),
        (snap) => {
          setNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          const fresh = snap.docChanges().some((c) => c.type === 'added' && !c.doc.metadata.hasPendingWrites);
          if (!firstN && fresh) vibrateRef.current([0, 120, 80, 120]);
          firstN = false;
        },
        noop
      )
    );

    let firstC = true;
    const lastMsgAt = {}; // chatId -> time of the last message we already knew about
    let lastBuzz = 0;
    unsubs.push(
      onSnapshot(
        query(collection(db, 'chats'), where('members', 'array-contains', meId)),
        (snap) => {
          const map = {};
          snap.docs.forEach((d) => (map[d.id] = { id: d.id, ...d.data(), _pending: d.metadata.hasPendingWrites }));
          setChats(map);
          // The chat document also changes when someone is typing or reads a chat.
          // Only a genuinely NEWER last-message time counts as a new message.
          let incomingMsg = false;
          snap.docs.forEach((d) => {
            const x = d.data();
            const t = x.lastMessageAt?.toMillis?.() || 0;
            if (t && t > (lastMsgAt[d.id] || 0)) {
              if (!d.metadata.hasPendingWrites && x.lastSender && x.lastSender !== meId && (x.unread?.[meId] || 0) > 0) incomingMsg = true;
              lastMsgAt[d.id] = t;
            }
          });
          // at most one buzz every 3 seconds
          if (!firstC && incomingMsg && Date.now() - lastBuzz > 3000) {
            lastBuzz = Date.now();
            vibrateRef.current(80);
          }
          firstC = false;
        },
        (err) => {
          // Before, this error was ignored, so the chat list never got live data (no unread, no order).
          console.warn('chats listener failed:', err?.code || err?.message || err);
          setChatsFallback(true);
        }
      )
    );
    return () => unsubs.forEach((u) => u());
  }, [meId]);

  // live profiles of my friends
  const friendKey = friendIds.slice().sort().join(',');
  useEffect(() => {
    if (!friendIds.length) {
      setFriendProfiles({});
      return undefined;
    }
    const parts = {};
    const unsubs = chunk(friendIds, 10).map((ids, i) =>
      onSnapshot(
        query(collection(db, 'users'), where('id', 'in', ids)),
        (snap) => {
          parts[i] = Object.fromEntries(snap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
          setFriendProfiles(Object.assign({}, ...Object.values(parts)));
        },
        noop
      )
    );
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendKey]);

  const friends = useMemo(
    () =>
      friendIds
        .map((id) => friendProfiles[id])
        .filter(Boolean)
        .sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [friendIds, friendProfiles]
  );

  const relationTo = useCallback(
    (userId) => {
      if (friendIds.includes(userId)) return 'friend';
      if (incoming.some((r) => r.from === userId)) return 'incoming';
      if (outgoing.some((r) => r.to === userId)) return 'outgoing';
      return 'none';
    },
    [friendIds, incoming, outgoing]
  );

  // Fallback: if the all-chats query is refused, listen to each friend's chat document one by one
  // (single-document reads are allowed by the rules). Chats with non-friends need the rules fix.
  const chatFriendKey = friendIds.slice().sort().join(',');
  useEffect(() => {
    if (!meId || !chatsFallback || !chatFriendKey) return undefined;
    const unsubs = chatFriendKey.split(',').map((fid) => {
      const id = chatIdFor(meId, fid);
      return onSnapshot(
        doc(db, 'chats', id),
        (s) =>
          setChats((prev) => {
            const next = { ...prev };
            if (s.exists()) next[id] = { id, ...s.data(), _pending: s.metadata.hasPendingWrites };
            else delete next[id];
            return next;
          }),
        noop
      );
    });
    return () => unsubs.forEach((u) => u());
  }, [meId, chatsFallback, chatFriendKey]);

  const unreadNotifs = notifications.filter((n) => !n.read).length;
  const unreadMessages = Object.values(chats).reduce((sum, c) => sum + unreadFor(c, meId), 0);

  const value = useMemo(
    () => ({ friendIds, friends, friendProfiles, incoming, outgoing, notifications, chats, relationTo, unreadNotifs, unreadMessages }),
    [friendIds, friends, friendProfiles, incoming, outgoing, notifications, chats, relationTo, unreadNotifs, unreadMessages]
  );
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export const useAppData = () => useContext(AppDataContext);
