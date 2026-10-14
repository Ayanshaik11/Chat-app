import AsyncStorage from '@react-native-async-storage/async-storage';
import { arrayUnion, collection, deleteField, doc, getDoc, increment, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import { encryptFor } from './crypto';
import { sendPushNotification } from './notifications';

export const chatIdFor = (a, b) => [a, b].filter(Boolean).sort().join('_');

const messageRef = (chatId, id) => doc(db, 'chats', chatId, 'messages', id);

/* =========================================================
   OUTBOX
   Every outgoing message is kept on the phone until the server confirms it,
   so it can never be lost if the app is closed / killed / offline.
   The message id is created on the phone, so a retry can never duplicate it.
========================================================= */

const OUTBOX_KEY = 'kx_outbox_v1';
const inflight = new Set(); // ids Firestore is already retrying in this session
let outboxQueue = Promise.resolve();

function withOutbox(fn) {
  const run = outboxQueue.then(async () => {
    let list = [];
    try { list = JSON.parse((await AsyncStorage.getItem(OUTBOX_KEY)) || '[]'); } catch { list = []; }
    const next = fn(list);
    if (next) await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(next));
    return list;
  });
  outboxQueue = run.catch(() => {});
  return run;
}

const outboxAdd = (entry) => withOutbox((l) => [...l.filter((e) => e.id !== entry.id), entry]).catch(() => {});
const outboxRemove = (id) => withOutbox((l) => l.filter((e) => e.id !== id)).catch(() => {});

// Saves one message and updates the chat summary (last message, unread count) together.
function commitMessage({ id, chatId, me, other, payload, summary }) {
  const batch = writeBatch(db);
  batch.set(messageRef(chatId, id), { ...payload, createdAt: serverTimestamp() });
  batch.set(
    doc(db, 'chats', chatId),
    { members: [me, other], ...summary, lastSender: me, lastMessageAt: serverTimestamp(), updatedAt: serverTimestamp(), unread: { [other]: increment(1) } },
    { merge: true }
  );
  return batch.commit();
}

/** Re-sends messages that were still waiting when the app was closed. Call on login / app resume. */
export async function flushOutbox(meId) {
  if (!meId) return;
  const list = await withOutbox(() => null);
  for (const entry of list) {
    if (entry.me !== meId || inflight.has(entry.id)) continue;
    try {
      const exists = await getDoc(messageRef(entry.chatId, entry.id));
      if (!exists.exists()) {
        inflight.add(entry.id);
        await commitMessage(entry);
      }
      await outboxRemove(entry.id);
    } catch (e) {
      // still offline -> keep it for next time; a permanent error is dropped
      if (e?.code === 'permission-denied' || e?.code === 'invalid-argument') await outboxRemove(entry.id);
    } finally {
      inflight.delete(entry.id);
    }
  }
}

/* ---------- core send ----------
   opts.notify  = { name, photo, body }  -> pushes a notification at the same moment (no message text in it)
   opts.onError = fn(err)                -> called if the server finally rejects the message        */

async function push(me, other, data, summary, replyTo, opts = {}) {
  if (!me || !other) throw new Error('Missing chat participants.');
  const chatId = chatIdFor(me, other);
  const id = doc(collection(db, 'chats', chatId, 'messages')).id;

  const payload = { senderId: me, receiverId: other, seenBy: {}, reactions: {}, unsent: false, ...data };

  if (replyTo) {
    payload.replyTo = { id: replyTo.id || null, senderId: replyTo.senderId || '', senderName: replyTo.senderName || 'Message' };
    if (replyTo.text) payload.replyTo.enc = await encryptFor(other, String(replyTo.text));
  }

  const entry = { id, chatId, me, other, payload, summary };

  // 1) start the write now - it shows in the chat instantly (offline too)
  inflight.add(id);
  const commit = commitMessage(entry);

  // 2) keep a copy on the phone until the server confirms it
  outboxAdd(entry);

  // 3) tell the other phone at the same moment (does not wait for the server)
  if (opts.notify) {
    sendPushNotification({
      toUserId: other,
      title: opts.notify.name || 'New message',
      body: opts.notify.body || 'New message',
      data: { type: 'message', fromId: me, fromName: opts.notify.name || '', fromPhoto: opts.notify.photo || '', messageId: id },
    }).catch(() => {});
  }

  commit
    .then(() => outboxRemove(id))
    .catch((e) => {
      if (e?.code === 'permission-denied' || e?.code === 'invalid-argument') {
        outboxRemove(id);
        opts.onError?.(e);
      }
      // network errors: Firestore keeps retrying and the outbox keeps a copy
    })
    .finally(() => inflight.delete(id));

  return { id };
}

/* ---------- send ---------- */

// Text is end-to-end encrypted. Throws NoKeyError if the friend has not opened the updated app yet.
export async function sendMessage(me, other, text, replyTo = null, opts = {}) {
  const clean = String(text || '').trim();
  if (!clean) return;
  const enc = await encryptFor(other, clean);
  // placeholder text for old app versions; the real text is only in `enc` / `lastEnc`
  return push(me, other, { type: 'text', enc }, { lastMessage: 'Encrypted message', lastEnc: enc }, replyTo, {
    ...opts,
    notify: opts.notify && { ...opts.notify, body: 'New message' },
  });
}

export async function sendVoiceMessage(me, other, audioUrl, duration = 0, replyTo = null, opts = {}) {
  if (!audioUrl) throw new Error('Missing voice message file.');
  return push(me, other, { type: 'audio', text: 'Voice message', audioUrl, duration: Math.round(Number(duration) || 0) }, { lastMessage: 'Voice message' }, replyTo, {
    ...opts,
    notify: opts.notify && { ...opts.notify, body: 'Voice message' },
  });
}

// The caption is encrypted; the photos themselves are not (they are stored as normal files).
export async function sendImageMessage(me, other, images, caption = '', replyTo = null, opts = {}) {
  if (!images?.length) throw new Error('Nothing to send.');
  const note = String(caption || '').trim();
  const label = images.length > 1 ? `${images.length} photos` : 'Photo';
  const data = { type: 'image', images, text: label };
  if (note) data.enc = await encryptFor(other, note);
  return push(me, other, data, { lastMessage: label }, replyTo, {
    ...opts,
    notify: opts.notify && { ...opts.notify, body: label },
  });
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
  await updateDoc(messageRef(chatId, messageId), { text: 'This message was unsent', enc: deleteField(), unsent: true, reactions: deleteField(), replyTo: deleteField() });
}

export async function deleteMessageForMe(chatId, messageId, userId) {
  if (chatId && messageId && userId) await updateDoc(messageRef(chatId, messageId), { deletedFor: arrayUnion(userId) });
}
