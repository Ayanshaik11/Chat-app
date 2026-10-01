import { collection, doc, increment, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import { PROXY_BASE_URL } from '../config/proxy';
import { pairId } from '../utils/helpers';

// Asks the Vercel proxy to push a real system notification to the other
// person's phone — never blocks or fails the message itself if it errors.
function notifyNewMessage(me, other, text) {
  if (!PROXY_BASE_URL || PROXY_BASE_URL.includes('YOUR-PROJECT')) return;
  fetch(`${PROXY_BASE_URL}/api/send-notification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      toUserId: other.id,
      title: me.name || 'New message',
      body: text,
      data: { type: 'message', fromId: me.id, fromName: me.name || '', fromPhoto: me.photoURL || '' },
    }),
  }).catch(() => {});
}

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
  notifyNewMessage(me, other, text);
}

export const markChatRead = (chatId, meId) =>
  setDoc(doc(db, 'chats', chatId), { unread: { [meId]: 0 }, lastRead: { [meId]: serverTimestamp() } }, { merge: true });

// Shown to the other person as a live "typing…" indicator while this is true
export const setTyping = (chatId, meId, isTyping) =>
  setDoc(doc(db, 'chats', chatId), { typing: { [meId]: isTyping } }, { merge: true }).catch(() => {});
