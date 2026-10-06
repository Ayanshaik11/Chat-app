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
// SEND PUSH NOTIFICATION
// ---------------------------------------------------------

// Asks the Vercel proxy to push a real system notification
// to the other person's phone.
// Notification failure never blocks the message itself.
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

  // Only add replyTo when replying to another message.
  if (replyTo) {
    messageData.replyTo = {
      id: replyTo.id,
      text: replyTo.text || '',
      senderId: replyTo.senderId || '',
    };
  }

  // Create message
  batch.set(msgRef, messageData);

  // Update chat preview / unread count
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

  // Push notification after successful message creation.
  notifyNewMessage(me, other, text);
}

// ---------------------------------------------------------
// MARK CHAT AS READ
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
// TYPING INDICATOR
// ---------------------------------------------------------

// Shown to the other person as a live "typing..." indicator.
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
// REACT TO MESSAGE
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

  /*
   * IMPORTANT:
   *
   * Do NOT do:
   *
   * reactions: {
   *   [userId]: emoji
   * }
   *
   * with merge:true.
   *
   * That can replace the whole reactions map.
   *
   * This nested field update changes only this user's
   * reaction and keeps everybody else's reaction.
   */

  await updateDoc(ref, {
    [`reactions.${userId}`]: emoji,
  });
}

// ---------------------------------------------------------
// REMOVE REACTION
// ---------------------------------------------------------

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
// UNSEND MESSAGE
// ---------------------------------------------------------

export async function unsendMessage(
  chatId,
  messageId
) {
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

    // Remove reactions
    reactions: deleteField(),

    // Remove reply information
    replyTo: deleteField(),
  });
}

// ---------------------------------------------------------
// DELETE MESSAGE FOR ME
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