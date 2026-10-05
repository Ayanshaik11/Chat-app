import {
  arrayUnion,
  collection,
  deleteField,
  doc,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { PROXY_BASE_URL } from '../config/proxy';
import { pairId } from '../utils/helpers';

// Push notification for a new message.
function notifyNewMessage(me, other, text) {
  if (!PROXY_BASE_URL || PROXY_BASE_URL.includes('YOUR-PROJECT')) return;

  fetch(`${PROXY_BASE_URL}/api/send-notification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      toUserId: other.id,
      title: me.name || 'New message',
      body: text,
      data: {
        type: 'message',
        fromId: me.id,
        fromName: me.name || '',
        fromPhoto: me.photoURL || '',
      },
    }),
  }).catch(() => {});
}

export const chatIdFor = pairId;

export async function sendMessage(me, other, text, replyTo = null) {
  const chatId = chatIdFor(me.id, other.id);
  const msgRef = doc(collection(db, 'chats', chatId, 'messages'));

  const message = {
    senderId: me.id,
    text,
    createdAt: serverTimestamp(),
  };

  if (replyTo) {
    message.replyTo = {
      id: replyTo.id,
      text: replyTo.text || '',
      senderId: replyTo.senderId,
    };
  }

  const batch = writeBatch(db);

  batch.set(msgRef, message);

  batch.set(
    doc(db, 'chats', chatId),
    {
      members: [me.id, other.id],
      lastMessage: text,
      lastSender: me.id,
      lastMessageAt: serverTimestamp(),
      unread: {
        [other.id]: increment(1),
      },
    },
    { merge: true }
  );

  await batch.commit();

  notifyNewMessage(me, other, text);

  return msgRef.id;
}

// Mark chat as read.
export const markChatRead = (chatId, meId) =>
  setDoc(
    doc(db, 'chats', chatId),
    {
      unread: {
        [meId]: 0,
      },
      lastRead: {
        [meId]: serverTimestamp(),
      },
    },
    { merge: true }
  );

// Typing indicator.
export const setTyping = (chatId, meId, isTyping) =>
  setDoc(
    doc(db, 'chats', chatId),
    {
      typing: {
        [meId]: isTyping,
      },
    },
    { merge: true }
  ).catch(() => {});

// ❤️ 😂 😅 etc.
export async function reactToMessage(chatId, messageId, userId, emoji) {
  const ref = doc(db, 'chats', chatId, 'messages', messageId);

  await setDoc(
    ref,
    {
      reactions: {
        [userId]: emoji,
      },
    },
    { merge: true }
  );
}

// Remove the current user's reaction.
export async function removeReaction(chatId, messageId, userId) {
  const ref = doc(db, 'chats', chatId, 'messages', messageId);

  await updateDoc(ref, {
    [`reactions.${userId}`]: deleteField(),
  });
}

// 🔴 Unsend — removes the message content for everyone.
export async function unsendMessage(chatId, messageId) {
  const ref = doc(db, 'chats', chatId, 'messages', messageId);

  await updateDoc(ref, {
    text: 'This message was unsent',
    unsent: true,
    reactions: deleteField(),
    replyTo: deleteField(),
  });
}

// 🗑️ Delete for you.
// We store the user's ID in deletedFor so the other person still sees it.
export async function deleteMessageForMe(chatId, messageId, userId) {
  const ref = doc(db, 'chats', chatId, 'messages', messageId);

  await updateDoc(ref, {
    deletedFor: arrayUnion(userId),
  });
}