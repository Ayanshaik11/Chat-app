import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { chunk } from '../utils/helpers';
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
    unsubs.push(
      onSnapshot(
        query(collection(db, 'chats'), where('members', 'array-contains', meId)),
        (snap) => {
          const map = {};
          snap.docs.forEach((d) => (map[d.id] = { id: d.id, ...d.data() }));
          setChats(map);
          const incomingMsg = snap.docChanges().some((c) => {
            const x = c.doc.data();
            return (
              !c.doc.metadata.hasPendingWrites &&
              c.type !== 'removed' &&
              x.lastSender &&
              x.lastSender !== meId &&
              (x.unread?.[meId] || 0) > 0
            );
          });
          if (!firstC && incomingMsg) vibrateRef.current(80);
          firstC = false;
        },
        noop
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

  const unreadNotifs = notifications.filter((n) => !n.read).length;
  const unreadMessages = Object.values(chats).reduce((sum, c) => sum + (c.unread?.[meId] || 0), 0);

  const value = useMemo(
    () => ({ friendIds, friends, friendProfiles, incoming, outgoing, notifications, chats, relationTo, unreadNotifs, unreadMessages }),
    [friendIds, friends, friendProfiles, incoming, outgoing, notifications, chats, relationTo, unreadNotifs, unreadMessages]
  );
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export const useAppData = () => useContext(AppDataContext);
