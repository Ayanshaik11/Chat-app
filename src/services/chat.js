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

// ---------------------------------------------------------
// NOTIFICATION
// ---------------------------------------------------------

function notifyNewMessage(me, other, text) {
  if (!PROXY_BASE_URL || PROXY_BASE_URL.includes('YOUR-PROJECT')) {
    return;
  }

  fetch(`${PROXY_BASE_URL}/api/send-notification`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
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

// ---------------------------------------------------------
// CHAT ID
// ---------------------------------------------------------

export const chatIdFor = pairId;

// ---------------------------------------------------------
// SEND MESSAGE
// ---------------------------------------------------------

export async function sendMessage(me, other, text, replyTo = null) {
  const chatId = chatIdFor(me.id, other.id);

  const msgRef = doc(
    collection(db, 'chats', chatId, 'messages')
  );

  const batch = writeBatch(db);

  const messageData = {
    senderId: me.id,
    text,
    createdAt: serverTimestamp(),
  };

  if (replyTo) {
    messageData.replyTo = {
      id: replyTo.id,
      text: replyTo.text || '',
      senderId: replyTo.senderId || '',
    };
  }

  batch.set(msgRef, messageData);

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
    {
      merge: true,
    }
  );

  await batch.commit();

  notifyNewMessage(me, other, text);
}

// ---------------------------------------------------------
// CHAT READ
// ---------------------------------------------------------

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
    {
      merge: true,
    }
  );

// ---------------------------------------------------------
// MARK MESSAGES SEEN
// ---------------------------------------------------------

export async function markMessagesSeen(chatId, messages, meId) {
  const incoming = messages.filter(
    (message) =>
      message.senderId !== meId &&
      !message.unsent &&
      !message.deletedFor?.includes(meId)
  );

  if (!incoming.length) return;

  const batch = writeBatch(db);

  incoming.forEach((message) => {
    const ref = doc(
      db,
      'chats',
      chatId,
      'messages',
      message.id
    );

    batch.update(ref, {
      [`seenBy.${meId}`]: serverTimestamp(),
    });
  });

  await batch.commit();
}

// ---------------------------------------------------------
// TYPING
// ---------------------------------------------------------

export const setTyping = (chatId, meId, isTyping) =>
  setDoc(
    doc(db, 'chats', chatId),
    {
      typing: {
        [meId]: isTyping,
      },
    },
    {
      merge: true,
    }
  ).catch(() => {});

// ---------------------------------------------------------
// REACTIONS
// ---------------------------------------------------------

export async function reactToMessage(
  chatId,
  messageId,
  userId,
  emoji
) {
  const ref = doc(
    db,
    'chats',
    chatId,
    'messages',
    messageId
  );

  await updateDoc(ref, {
    [`reactions.${userId}`]: emoji,
  });
}

export async function removeReaction(
  chatId,
  messageId,
  userId
) {
  const ref = doc(
    db,
    'chats',
    chatId,
    'messages',
    messageId
  );

  await updateDoc(ref, {
    [`reactions.${userId}`]: deleteField(),
  });
}

// ---------------------------------------------------------
// UNSEND
// ---------------------------------------------------------

export async function unsendMessage(chatId, messageId) {
  const ref = doc(
    db,
    'chats',
    chatId,
    'messages',
    messageId
  );

  await updateDoc(ref, {
    text: 'This message was unsent',
    unsent: true,
    reactions: deleteField(),
    replyTo: deleteField(),
  });
}

// ---------------------------------------------------------
// DELETE FOR ME
// ---------------------------------------------------------

export async function deleteMessageForMe(
  chatId,
  messageId,
  userId
) {
  const ref = doc(
    db,
    'chats',
    chatId,
    'messages',
    messageId
  );

  await updateDoc(ref, {
    deletedFor: arrayUnion(userId),
  });
}