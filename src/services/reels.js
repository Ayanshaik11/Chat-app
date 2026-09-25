import {
  arrayRemove, arrayUnion, collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { deleteFile, extOf, mimeOf, uploadFile } from './media';
import { chunk, toMillis } from '../utils/helpers';

const byNewest = (a, b) => toMillis(b.createdAt) - toMillis(a.createdAt);

export async function createReel(me, asset, caption, onProgress) {
  const id = doc(collection(db, 'reels')).id;
  const mime = mimeOf(asset);
  const storagePath = `reels/${me.id}/${id}.${extOf(mime)}`;
  const videoURL = await uploadFile(asset.uri, storagePath, mime, onProgress);
  await setDoc(doc(db, 'reels', id), {
    authorId: me.id,
    videoURL,
    storagePath,
    caption: (caption || '').trim(),
    likes: [],
    createdAt: serverTimestamp(),
  });
  return id;
}

export const toggleReelLike = (reelId, meId, alreadyLiked) =>
  updateDoc(doc(db, 'reels', reelId), { likes: alreadyLiked ? arrayRemove(meId) : arrayUnion(meId) });

export async function deleteReel(reel) {
  await deleteDoc(doc(db, 'reels', reel.id));
  await deleteFile(reel.storagePath);
}

// Reels from me + friends — same "your circle" model the rest of the app uses
export async function fetchReels(authorIds) {
  const parts = await Promise.all(
    chunk(authorIds, 10).map((ids) => getDocs(query(collection(db, 'reels'), where('authorId', 'in', ids))))
  );
  return parts.flatMap((s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))).sort(byNewest);
}
