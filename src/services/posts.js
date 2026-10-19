import {
  arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { deleteFile, extOf, mimeOf, uploadFile } from './media';
import { chunk, toMillis } from '../utils/helpers';

const byNewest = (a, b) => toMillis(b.createdAt) - toMillis(a.createdAt);

// assets = one photo or a list of photos (a swipeable post). The first photo stays in imageURL,
// so profile grids and older app versions keep working.
export async function createPost(me, assets, caption, onProgress, music) {
  const list = Array.isArray(assets) ? assets : [assets];
  const id = doc(collection(db, 'posts')).id;
  const paths = list.map((a, i) => `posts/${me.id}/${id}${i ? `_${i}` : ''}.${extOf(mimeOf(a))}`);
  const urls = [];
  for (let i = 0; i < list.length; i += 1) {
    urls.push(await uploadFile(list[i].uri, paths[i], mimeOf(list[i]), (p) => onProgress && onProgress((i + p) / list.length)));
  }
  const song = music || list[0]?.music;
  await setDoc(doc(db, 'posts', id), {
    authorId: me.id,
    imageURL: urls[0],
    ...(urls.length > 1 ? { images: urls, storagePaths: paths } : {}),
    storagePath: paths[0],
    caption: (caption || '').trim(),
    ...(song ? { music: song } : {}),
    likes: [],
    createdAt: serverTimestamp(),
  });
  return id;
}

export const toggleLike = (postId, meId, alreadyLiked) =>
  updateDoc(doc(db, 'posts', postId), { likes: alreadyLiked ? arrayRemove(meId) : arrayUnion(meId) });

export async function deletePost(post) {
  await deleteDoc(doc(db, 'posts', post.id));
  await Promise.all([post.storagePath, ...(post.storagePaths || [])].filter(Boolean).map((p) => deleteFile(p)));
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
