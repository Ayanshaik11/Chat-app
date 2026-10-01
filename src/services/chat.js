import {
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


// --------------------------------------------------
// Push notification helper
// --------------------------------------------------

function sendPushNotification({
  toUserId,
  title,
  body,
  data,
}) {
  if (
    !PROXY_BASE_URL ||
    PROXY_BASE_URL.includes('YOUR-PROJECT')
  ) {
    return;
  }

  fetch(
    `${PROXY_BASE_URL}/api/send-notification`,
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        toUserId,
        title,
        body,
        data,
      }),
    }
  ).catch(() => {});
}


// --------------------------------------------------
// New message notification
// --------------------------------------------------

function notifyNewMessage(
  me,
  other,
  text
) {
  sendPushNotification({
    toUserId: other.id,

    title:
      me.name ||
      'New message',

    body: text,

    data: {
      type: 'message',

      fromId: me.id,

      fromName:
        me.name || '',

      fromPhoto:
        me.photoURL || '',
    },
  });
}


// --------------------------------------------------
// Reaction notification
// --------------------------------------------------

function notifyReaction(
  me,
  message,
  reaction
) {
  /*
   * Don't notify when reacting
   * to your own message.
   */
  if (
    !message.senderId ||
    message.senderId === me.id
  ) {
    return;
  }


  let action = 'reacted to';


  if (reaction === '❤️') {
    action = 'liked';
  }


  const messagePreview =
    message.text
      ? `"${message.text.slice(0, 80)}${
          message.text.length > 80
            ? '…'
            : ''
        }"`
      : 'your message';


  let body;


  if (reaction === '❤️') {
    body =
      `${me.name || 'Someone'} liked your message`;
  } else {
    body =
      `${me.name || 'Someone'} reacted ${reaction} to your message`;
  }


  /*
   * Add the message preview as
   * notification data.
   *
   * The current push body stays clean.
   */
  sendPushNotification({
    toUserId: message.senderId,

    title:
      reaction === '❤️'
        ? '❤️ Message liked'
        : `${reaction} Message reaction`,

    body,

    data: {
      type: 'reaction',

      reaction,

      messageId:
        message.id,

      messageText:
        message.text || '',

      messagePreview,

      fromId: me.id,

      fromName:
        me.name || '',

      fromPhoto:
        me.photoURL || '',
    },
  });
}


// --------------------------------------------------
// Chat ID
// --------------------------------------------------

export const chatIdFor = pairId;


// --------------------------------------------------
// Send message
// --------------------------------------------------

export async function sendMessage(
  me,
  other,
  text,
  replyTo = null
) {
  const chatId =
    chatIdFor(
      me.id,
      other.id
    );


  const msgRef = doc(
    collection(
      db,
      'chats',
      chatId,
      'messages'
    )
  );


  const message = {
    senderId: me.id,

    text,

    createdAt:
      serverTimestamp(),
  };


  if (replyTo) {
    message.replyTo = {
      id: replyTo.id,

      text:
        replyTo.text ||
        'Message',

      senderId:
        replyTo.senderId,

      senderName:
        replyTo.senderId === me.id
          ? 'You'
          : other.name || 'User',
    };
  }


  const batch =
    writeBatch(db);


  batch.set(
    msgRef,
    message
  );


  batch.set(
    doc(
      db,
      'chats',
      chatId
    ),
    {
      members: [
        me.id,
        other.id,
      ],

      lastMessage:
        text,

      lastSender:
        me.id,

      lastMessageAt:
        serverTimestamp(),

      unread: {
        [other.id]:
          increment(1),
      },
    },
    {
      merge: true,
    }
  );


  await batch.commit();


  // Existing message notification
  notifyNewMessage(
    me,
    other,
    text
  );


  return msgRef.id;
}


// --------------------------------------------------
// Mark chat read
// --------------------------------------------------

export const markChatRead = (
  chatId,
  meId
) =>
  setDoc(
    doc(
      db,
      'chats',
      chatId
    ),
    {
      unread: {
        [meId]: 0,
      },

      lastRead: {
        [meId]:
          serverTimestamp(),
      },
    },
    {
      merge: true,
    }
  );


// --------------------------------------------------
// Typing
// --------------------------------------------------

export const setTyping = (
  chatId,
  meId,
  isTyping
) =>
  setDoc(
    doc(
      db,
      'chats',
      chatId
    ),
    {
      typing: {
        [meId]:
          isTyping,
      },
    },
    {
      merge: true,
    }
  ).catch(() => {});


// --------------------------------------------------
// React to message
// --------------------------------------------------

export async function reactToMessage(
  chatId,
  message,
  me,
  reaction
) {
  const ref = doc(
    db,
    'chats',
    chatId,
    'messages',
    message.id
  );


  const oldReaction =
    message.reactions?.[
      me.id
    ] || null;


  /*
   * Tapping the same reaction
   * removes the reaction.
   */
  if (
    oldReaction === reaction
  ) {
    await updateDoc(
      ref,
      {
        [`reactions.${me.id}`]:
          deleteField(),
      }
    );

    return;
  }


  /*
   * Save the new reaction.
   */
  await updateDoc(
    ref,
    {
      [`reactions.${me.id}`]:
        reaction,
    }
  );


  /*
   * Only notify for a new reaction.
   *
   * If user changes:
   *
   * ❤️ → 😂
   *
   * this sends the new reaction
   * notification.
   */
  if (reaction) {
    notifyReaction(
      me,
      message,
      reaction
    );
  }
}


// --------------------------------------------------
// Unsend message
// --------------------------------------------------

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


  await updateDoc(
    ref,
    {
      text: '',

      unsent: true,

      reactions:
        deleteField(),

      replyTo:
        deleteField(),
    }
  );
}


// --------------------------------------------------
// Delete message only for me
// --------------------------------------------------

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


  await updateDoc(
    ref,
    {
      [`deletedFor.${userId}`]:
        true,
    }
  );
}