import { doc, setDoc, deleteDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { addNotification } from './notifications';
import { pairId } from '../utils/helpers';

export async function sendRequest(me, target) {
  await setDoc(doc(db, 'requests', `${me.id}_${target.id}`), {
    from: me.id,
    to: target.id,
    fromName: me.name || '',
    fromPhoto: me.photoURL || '',
    fromEmail: me.email || '',
    status: 'pending',
    createdAt: serverTimestamp(),
  });
  addNotification(target.id, {
    type: 'request',
    fromId: me.id,
    fromName: me.name || '',
    fromPhoto: me.photoURL || '',
    text: `${me.name || 'Someone'} sent you a friend request`,
  }).catch(() => {});
}

export const cancelRequest = (meId, targetId) => deleteDoc(doc(db, 'requests', `${meId}_${targetId}`));

export async function acceptRequest(me, req) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'friendships', pairId(me.id, req.from)), {
    members: [me.id, req.from],
    createdAt: serverTimestamp(),
  });
  batch.delete(doc(db, 'requests', req.id));
  await batch.commit();
  addNotification(req.from, {
    type: 'accepted',
    fromId: me.id,
    fromName: me.name || '',
    fromPhoto: me.photoURL || '',
    text: `${me.name || 'Someone'} accepted your friend request`,
  }).catch(() => {});
}

export const declineRequest = (req) => deleteDoc(doc(db, 'requests', req.id));

export const removeFriend = (meId, friendId) => deleteDoc(doc(db, 'friendships', pairId(meId, friendId)));
