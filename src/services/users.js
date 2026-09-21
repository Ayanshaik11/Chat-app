import { collection, doc, getDocs, limit, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../config/firebase';

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
