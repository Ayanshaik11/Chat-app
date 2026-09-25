import {
  collection, deleteDoc, doc, getCountFromServer, onSnapshot, orderBy, query, serverTimestamp, setDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const commentsRef = (postId) => collection(db, 'posts', postId, 'comments');

export function addComment(postId, me, text) {
  const id = doc(commentsRef(postId)).id;
  return setDoc(doc(commentsRef(postId), id), {
    authorId: me.id,
    authorName: me.name || 'User',
    authorPhoto: me.photoURL || '',
    text: text.trim(),
    createdAt: serverTimestamp(),
  });
}

export const deleteComment = (postId, commentId) => deleteDoc(doc(commentsRef(postId), commentId));

// Live list of comments, oldest first — used on the post detail screen
export function subscribeComments(postId, onChange) {
  return onSnapshot(
    query(commentsRef(postId), orderBy('createdAt', 'asc')),
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => {}
  );
}

// Cheap count (no document reads) — used to show "12 comments" on the feed card
export async function getCommentCount(postId) {
  try {
    const snap = await getCountFromServer(commentsRef(postId));
    return snap.data().count;
  } catch {
    return 0;
  }
}
