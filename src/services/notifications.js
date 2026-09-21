import { addDoc, collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

// users/{userId}/notifications/{id}
export function addNotification(userId, data) {
  return addDoc(collection(db, 'users', userId, 'notifications'), {
    read: false,
    createdAt: serverTimestamp(),
    ...data,
  });
}

export async function markAllRead(userId, list) {
  const unread = list.filter((n) => !n.read).slice(0, 400);
  if (!unread.length) return;
  const batch = writeBatch(db);
  unread.forEach((n) => batch.update(doc(db, 'users', userId, 'notifications', n.id), { read: true }));
  await batch.commit();
}

export async function clearAllNotifications(userId, list) {
  const items = list.slice(0, 400);
  if (!items.length) return;
  const batch = writeBatch(db);
  items.forEach((n) => batch.delete(doc(db, 'users', userId, 'notifications', n.id)));
  await batch.commit();
}
