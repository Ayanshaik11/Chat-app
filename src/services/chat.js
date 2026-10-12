import { arrayUnion, collection, deleteField, doc, increment, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';

export const chatIdFor = (a, b) => [a, b].filter(Boolean).sort().join('_');

const messageRef = (chatId, id) => doc(db, 'chats', chatId, 'messages', id);

// Saves one message and updates the chat summary (last message, unread count) together.
async function push(me, other, data, summary, replyTo) {
  if (!me || !other) throw new Error('Missing chat participants.');
  const chatId = chatIdFor(me, other);
  const message = { senderId: me, receiverId: other, createdAt: serverTimestamp(), seenBy: {}, reactions: {}, unsent: false, ...data };
  if (replyTo) message.replyTo = { id: replyTo.id || null, text: replyTo.text || '', senderId: replyTo.senderId || '', senderName: replyTo.senderName || 'Message' };

  const batch = writeBatch(db);
  batch.set(doc(collection(db, 'chats', chatId, 'messages')), message);
  batch.set(
    doc(db, 'chats', chatId),
    { members: [me, other], lastMessage: summary, lastSender: me, lastMessageAt: serverTimestamp(), updatedAt: serverTimestamp(), unread: { [other]: increment(1) } },
    { merge: true }
  );
  await batch.commit();
}

/* ---------- send ---------- */

export async function sendMessage(me, other, text, replyTo = null) {
  const clean = String(text || '').trim();
  if (clean) await push(me, other, { text: clean }, clean, replyTo);
}

export async function sendVoiceMessage(me, other, audioUrl, duration = 0, replyTo = null) {
  if (!audioUrl) throw new Error('Missing voice message file.');
  await push(me, other, { type: 'audio', text: 'Voice message', audioUrl, duration: Math.round(Number(duration) || 0) }, 'Voice message', replyTo);
}

export async function sendImageMessage(me, other, images, caption = '', replyTo = null) {
  if (!images?.length) throw new Error('Nothing to send.');
  const note = String(caption || '').trim();
  const label = images.length > 1 ? `${images.length} photos` : 'Photo';
  await push(me, other, { type: 'image', images, caption: note, text: note || label }, note || label, replyTo);
}

/* ---------- read / seen / typing ---------- */

export async function markChatRead(chatId, userId) {
  if (!chatId || !userId) return;
  await setDoc(doc(db, 'chats', chatId), { unread: { [userId]: 0 }, lastRead: { [userId]: serverTimestamp() } }, { merge: true });
}

export async function markMessagesSeen(chatId, messages, meId) {
  if (!chatId || !meId || !Array.isArray(messages)) return;
  const unseen = messages.filter((m) => m?.id && m.senderId !== meId && !m.seenBy?.[meId]);
  if (!unseen.length) return;
  const batch = writeBatch(db);
  unseen.forEach((m) => batch.update(messageRef(chatId, m.id), { [`seenBy.${meId}`]: serverTimestamp() }));
  await batch.commit();
}

// A changing timestamp (not true/false): the other phone checks that it is fresh.
export async function setTyping(chatId, userId, value) {
  if (!chatId || !userId) return;
  await setDoc(doc(db, 'chats', chatId), { typing: { [userId]: value ? Date.now() : 0 } }, { merge: true });
}

/* ---------- reactions / unsend / delete ---------- */

export async function reactToMessage(chatId, messageId, userId, emoji) {
  if (chatId && messageId && userId && emoji) await updateDoc(messageRef(chatId, messageId), { [`reactions.${userId}`]: emoji });
}

export async function removeReaction(chatId, messageId, userId) {
  if (chatId && messageId && userId) await updateDoc(messageRef(chatId, messageId), { [`reactions.${userId}`]: deleteField() });
}

export async function unsendMessage(chatId, messageId, userId) {
  if (!chatId || !messageId || !userId) return;
  await updateDoc(messageRef(chatId, messageId), { text: 'This message was unsent', unsent: true, reactions: deleteField(), replyTo: deleteField() });
}

export async function deleteMessageForMe(chatId, messageId, userId) {
  if (chatId && messageId && userId) await updateDoc(messageRef(chatId, messageId), { deletedFor: arrayUnion(userId) });
}
