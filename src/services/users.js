import { collection, doc, documentId, getDocs, limit, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { chunk } from '../utils/helpers';

// Profiles for a known set of ids (used for chats with people who are not friends).
export async function getUsersByIds(ids = []) {
  const clean = [...new Set(ids.filter(Boolean))];
  if (!clean.length) return [];
  const parts = await Promise.all(
    chunk(clean, 10).map(async (part) => {
      const snap = await getDocs(query(collection(db, 'users'), where(documentId(), 'in', part)));
      return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
    })
  );
  return parts.flat();
}

// Find people by Gmail address (prefix search, e.g. "john" or "john@gmail.com")
export async function searchUsersByEmail(text, meId) {
  const q = text.trim().toLowerCase();
  if (q.length < 3) return [];
  const snap = await getDocs(
    query(
      collection(db, 'users'),
      where('emailLower', '>=', q),
      where('emailLower', '<=', q + '\uf8ff'),
      limit(20)
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((u) => u.id !== meId);
}

// Latest people who joined (used for "New on Chat App")
export async function newestUsers(meId) {
  const snap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(20)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((u) => u.id !== meId);
}

export const updateProfile = (meId, data) => updateDoc(doc(db, 'users', meId), data);
