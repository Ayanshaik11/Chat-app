import { collection, doc, increment, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import { pairId } from '../utils/helpers';

export const chatIdFor = pairId;

export async function sendMessage(me, other, text) {
  const chatId = chatIdFor(me.id, other.id);
  const msgRef = doc(collection(db, 'chats', chatId, 'messages'));
  const batch = writeBatch(db);
  batch.set(msgRef, { senderId: me.id, text, createdAt: serverTimestamp() });
  batch.set(
    doc(db, 'chats', chatId),
    {
      members: [me.id, other.id],
      lastMessage: text,
      lastSender: me.id,
      lastMessageAt: serverTimestamp(),
      unread: { [other.id]: increment(1) },
    },
    { merge: true }
  );
  await batch.commit();
}

export const markChatRead = (chatId, meId) =>
  setDoc(doc(db, 'chats', chatId), { unread: { [meId]: 0 }, lastRead: { [meId]: serverTimestamp() } }, { merge: true });

// Shown to the other person as a live "typing…" indicator while this is true
export const setTyping = (chatId, meId, isTyping) =>
  setDoc(doc(db, 'chats', chatId), { typing: { [meId]: isTyping } }, { merge: true }).catch(() => {});
