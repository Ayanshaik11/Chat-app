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

/* =========================================================
   CHAT ID
========================================================= */

export function chatIdFor(a, b) {
  return [a, b]
    .filter(Boolean)
    .sort()
    .join('_');
}

/* =========================================================
   SEND MESSAGE
========================================================= */

export async function sendMessage(
  me,
  other,
  text,
  replyTo = null
) {
  if (!me || !other) {
    throw new Error('Missing chat participants.');
  }

  const cleanText = String(text || '').trim();

  if (!cleanText) {
    return;
  }

  const chatId = chatIdFor(me, other);

  if (!chatId) {
    throw new Error('Invalid chat ID.');
  }

  const chatRef = doc(
    db,
    'chats',
    chatId
  );

  const messageRef = doc(
    collection(
      db,
      'chats',
      chatId,
      'messages'
    )
  );

  const batch = writeBatch(db);

  const messageData = {
    senderId: me,
    receiverId: other,
    text: cleanText,

    createdAt: serverTimestamp(),

    seenBy: {},
    reactions: {},

    unsent: false,
  };

  if (replyTo) {
    messageData.replyTo = {
      id: replyTo.id || null,
      text: replyTo.text || '',
      senderId: replyTo.senderId || '',
      senderName:
        replyTo.senderName ||
        'Message',
    };
  }

  /* -------------------------------------------------------
     MESSAGE
  ------------------------------------------------------- */

  batch.set(
    messageRef,
    messageData
  );

  /* -------------------------------------------------------
     CHAT SUMMARY

     lastSender is important for:
     "You: message"

     updatedAt is also maintained so the
     Messages screen can reliably sort
     conversations by most recent activity.
  ------------------------------------------------------- */

  batch.set(
    chatRef,
    {
      members: [me, other],

      lastMessage: cleanText,
      lastSender: me,

      lastMessageAt: serverTimestamp(),
      updatedAt: serverTimestamp(),

      [`unread.${other}`]:
        increment(1),
    },
    {
      merge: true,
    }
  );

  await batch.commit();
}

/* =========================================================
   MARK CHAT READ
========================================================= */

export async function markChatRead(
  chatId,
  userId
) {
  if (!chatId || !userId) {
    return;
  }

  const chatRef = doc(
    db,
    'chats',
    chatId
  );

  await setDoc(
    chatRef,
    {
      [`unread.${userId}`]: 0,

      [`lastRead.${userId}`]:
        serverTimestamp(),
    },
    {
      merge: true,
    }
  );
}

/* =========================================================
   MARK MESSAGES SEEN
========================================================= */

export async function markMessagesSeen(
  chatId,
  messages,
  meId
) {
  if (
    !chatId ||
    !meId ||
    !Array.isArray(messages) ||
    messages.length === 0
  ) {
    return;
  }

  const batch = writeBatch(db);

  let count = 0;

  messages.forEach(message => {
    if (
      !message?.id ||
      message.senderId === meId
    ) {
      return;
    }

    const alreadySeen =
      message.seenBy?.[meId];

    if (alreadySeen) {
      return;
    }

    const ref = doc(
      db,
      'chats',
      chatId,
      'messages',
      message.id
    );

    batch.update(ref, {
      [`seenBy.${meId}`]:
        serverTimestamp(),
    });

    count += 1;
  });

  if (count > 0) {
    await batch.commit();
  }
}

/* =========================================================
   TYPING
========================================================= */

export async function setTyping(
  chatId,
  userId,
  value
) {
  if (!chatId || !userId) {
    return;
  }

  const chatRef = doc(
    db,
    'chats',
    chatId
  );

  await setDoc(
    chatRef,
    {
      [`typing.${userId}`]: !!value,
    },
    {
      merge: true,
    }
  );
}

/* =========================================================
   REACT
========================================================= */

export async function reactToMessage(
  chatId,
  messageId,
  userId,
  emoji
) {
  if (
    !chatId ||
    !messageId ||
    !userId ||
    !emoji
  ) {
    return;
  }

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

/* =========================================================
   REMOVE REACTION
========================================================= */

export async function removeReaction(
  chatId,
  messageId,
  userId
) {
  if (
    !chatId ||
    !messageId ||
    !userId
  ) {
    return;
  }

  const ref = doc(
    db,
    'chats',
    chatId,
    'messages',
    messageId
  );

  await updateDoc(ref, {
    [`reactions.${userId}`]:
      deleteField(),
  });
}

/* =========================================================
   UNSEND
========================================================= */

export async function unsendMessage(
  chatId,
  messageId,
  userId
) {
  if (
    !chatId ||
    !messageId ||
    !userId
  ) {
    return;
  }

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

/* =========================================================
   DELETE FOR ME
========================================================= */

export async function deleteMessageForMe(
  chatId,
  messageId,
  userId
) {
  if (
    !chatId ||
    !messageId ||
    !userId
  ) {
    return;
  }

  const ref = doc(
    db,
    'chats',
    chatId,
    'messages',
    messageId
  );

  await updateDoc(ref, {
    deletedFor:
      arrayUnion(userId),
  });
}