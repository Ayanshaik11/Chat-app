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
// Push notification
// --------------------------------------------------

function notifyNewMessage(
  me,
  other,
  text
) {
  if (
    !PROXY_BASE_URL ||
    PROXY_BASE_URL.includes(
      'YOUR-PROJECT'
    )
  ) {
    return;
  }

  fetch(
    `${PROXY_BASE_URL}/api/send-notification`,
    {
      method: 'POST',

      headers: {
        'Content-Type':
          'application/json',
      },

      body: JSON.stringify({
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
      }),
    }
  ).catch(() => {});
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


  // Add reply information
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

      lastMessage: text,

      lastSender: me.id,

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
  messageId,
  userId,
  reaction
) {
  const ref = doc(
    db,
    'chats',
    chatId,
    'messages',
    messageId
  );


  if (!reaction) {
    await updateDoc(
      ref,
      {
        [`reactions.${userId}`]:
          deleteField(),
      }
    );

    return;
  }


  await updateDoc(
    ref,
    {
      [`reactions.${userId}`]:
        reaction,
    }
  );
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