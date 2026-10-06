import {
  collection, deleteDoc, doc, getCountFromServer, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const commentsRef = (reelId) => collection(db, 'reels', reelId, 'comments');

export function addReelComment(reelId, me, text) {
  const id = doc(commentsRef(reelId)).id;
  return setDoc(doc(commentsRef(reelId), id), {
    authorId: me.id,
    authorName: me.name || 'User',
    authorPhoto: me.photoURL || '',
    text: text.trim(),
    createdAt: serverTimestamp(),
  });
}

export const deleteReelComment = (reelId, commentId) => deleteDoc(doc(commentsRef(reelId), commentId));

export function subscribeReelComments(reelId, onChange) {
  return onSnapshot(
    query(commentsRef(reelId), orderBy('createdAt', 'asc')),
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => {}
  );
}

export async function getReelCommentCount(reelId) {
  try {
    const snap = await getCountFromServer(commentsRef(reelId));
    return snap.data().count;
  } catch {
    return 0;
  }
}

// One-time fetch of a reel's comments, oldest first
export async function fetchReelComments(reelId) {
  const snap = await getDocs(query(commentsRef(reelId), orderBy('createdAt', 'asc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
