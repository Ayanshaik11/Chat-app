import {
  arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { deleteFile, extOf, mimeOf, uploadFile } from './media';
import { chunk, toMillis } from '../utils/helpers';

const byNewest = (a, b) => toMillis(b.createdAt) - toMillis(a.createdAt);

export async function createPost(me, asset, caption, onProgress) {
  const id = doc(collection(db, 'posts')).id;
  const mime = mimeOf(asset);
  const storagePath = `posts/${me.id}/${id}.${extOf(mime)}`;
  const imageURL = await uploadFile(asset.uri, storagePath, mime, onProgress);
  await setDoc(doc(db, 'posts', id), {
    authorId: me.id,
    imageURL,
    storagePath,
    caption: (caption || '').trim(),
    likes: [],
    createdAt: serverTimestamp(),
  });
  return id;
}

export const toggleLike = (postId, meId, alreadyLiked) =>
  updateDoc(doc(db, 'posts', postId), { likes: alreadyLiked ? arrayRemove(meId) : arrayUnion(meId) });

export async function deletePost(post) {
  await deleteDoc(doc(db, 'posts', post.id));
  await deleteFile(post.storagePath);
}

export async function getPost(id) {
  const s = await getDoc(doc(db, 'posts', id));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

// posts of me + friends (chunks of 10 because of Firestore "in" limit)
export async function fetchFeed(authorIds) {
  const parts = await Promise.all(
    chunk(authorIds, 10).map((ids) => getDocs(query(collection(db, 'posts'), where('authorId', 'in', ids))))
  );
  return parts.flatMap((s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))).sort(byNewest);
}

export async function fetchUserPosts(userId) {
  const s = await getDocs(query(collection(db, 'posts'), where('authorId', '==', userId)));
  return s.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byNewest);
}
