import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { chunk } from '../utils/helpers';
import { useAppData } from '../context/AppDataContext';
import { setPeerKey } from '../services/crypto';

/**
 * Live profiles of the people in a group (friends and non-friends).
 * Returns { id: profile }. Also keeps their public keys fresh for encryption.
 */
export default function useGroupMembers(memberIds) {
  const { friendProfiles } = useAppData() || {};
  const [fetched, setFetched] = useState({});
  const key = (memberIds || []).slice().sort().join(',');

  useEffect(() => {
    const ids = key ? key.split(',') : [];
    if (!ids.length) {
      setFetched({});
      return undefined;
    }
    const parts = {};
    const unsubs = chunk(ids, 10).map((part, i) =>
      onSnapshot(
        query(collection(db, 'users'), where('id', 'in', part)),
        (snap) => {
          parts[i] = Object.fromEntries(snap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
          const all = Object.assign({}, ...Object.values(parts));
          Object.values(all).forEach((u) => setPeerKey(u.id, u.publicKey));
          setFetched(all);
        },
        () => {}
      )
    );
    return () => unsubs.forEach((u) => u());
  }, [key]);

  return useMemo(() => ({ ...(friendProfiles || {}), ...fetched }), [friendProfiles, fetched]);
}
