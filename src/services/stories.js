import { arrayUnion, collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, Timestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { deleteFile, extOf, isVideo, mimeOf, uploadFile } from './media';
import { chunk, toMillis } from '../utils/helpers';

export const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function createStory(me, asset, onProgress) {
  const id = doc(collection(db, 'stories')).id;
  const mime = mimeOf(asset);
  const storagePath = `stories/${me.id}/${id}.${extOf(mime)}`;
  const mediaURL = await uploadFile(asset.uri, storagePath, mime, onProgress);
  await setDoc(doc(db, 'stories', id), {
    authorId: me.id,
    mediaURL,
    mediaType: isVideo(asset) ? 'video' : 'image',
    storagePath,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + STORY_LIFETIME_MS),
  });
  return id;
}

// Only stories younger than 24h are returned
export async function fetchStories(authorIds) {
  const now = Date.now();
  const parts = await Promise.all(
    chunk(authorIds, 10).map((ids) => getDocs(query(collection(db, 'stories'), where('authorId', 'in', ids))))
  );
  return parts
    .flatMap((s) => s.docs.map((d) => ({ id: d.id, ...d.data() })))
    .filter((s) => toMillis(s.expiresAt) > now);
}

export const markStoryViewed = (storyId, viewerId) =>
  updateDoc(doc(db, 'stories', storyId), { viewedBy: arrayUnion(viewerId) }).catch(() => {});

export async function deleteStory(story) {
  await deleteDoc(doc(db, 'stories', story.id));
  await deleteFile(story.storagePath);
}

// Removes my own expired stories (doc + file). Also enable a Firestore TTL policy, see README.
export async function cleanupMyExpiredStories(meId) {
  const s = await getDocs(query(collection(db, 'stories'), where('authorId', '==', meId)));
  const now = Date.now();
  const expired = s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((x) => toMillis(x.expiresAt) <= now);
  await Promise.all(expired.map((x) => deleteStory(x).catch(() => {})));
}
