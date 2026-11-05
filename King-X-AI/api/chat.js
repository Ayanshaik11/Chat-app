'use strict';

const admin = require('firebase-admin');
const { getFirebaseApp, verifyUser } = require('../lib/firebase');
const { generateReply } = require('../lib/gemini');

const ID_PATTERN = /^[a-zA-Z0-9_-]{1,100}$/;

// Light protection against spamming: 20 requests per minute per user (per server instance).
const hits = new Map();
function rateLimited(uid) {
  const now = Date.now();
  const list = (hits.get(uid) || []).filter((t) => now - t < 60000);
  list.push(now);
  hits.set(uid, list);
  if (hits.size > 5000) hits.clear();
  return list.length > 20;
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function conversationId(value) {
  const id = value || 'main';
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
    throw httpError(400, 'Invalid conversation ID');
  }
  return id;
}

function refs(db, uid, id) {
  const conversation = db
    .collection('kingXAIUsers')
    .doc(uid)
    .collection('conversations')
    .doc(id);
  return { conversation, messages: conversation.collection('messages') };
}

// Each user only ever reads and writes kingXAIUsers/{their own uid}/..., so chats are private.
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  try {
    if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const user = await verifyUser(req);
    const db = getFirebaseApp().firestore();
    const FieldValue = admin.firestore.FieldValue;
    const Timestamp = admin.firestore.Timestamp;

    // ---------- GET: this user's saved conversation ----------
    if (req.method === 'GET') {
      const id = conversationId(req.query?.conversationId);
      const limit = Math.min(Math.max(parseInt(req.query?.limit, 10) || 50, 1), 100);
      const { messages } = refs(db, user.uid, id);

      const snap = await messages.orderBy('createdAt', 'desc').limit(limit).get();

      const list = snap.docs
        .reverse()
        .map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            role: data.role,
            text: data.text,
            createdAt: data.createdAt?.toMillis?.() || 0,
          };
        })
        .filter((m) => ['user', 'model'].includes(m.role) && typeof m.text === 'string');

      return res.status(200).json({ success: true, conversationId: id, messages: list });
    }

    // ---------- DELETE: clear this user's conversation ----------
    if (req.method === 'DELETE') {
      const id = conversationId(req.query?.conversationId);
      const { conversation, messages } = refs(db, user.uid, id);

      for (;;) {
        const snap = await messages.limit(400).get();
        if (snap.empty) break;
        const batch = db.batch();
        snap.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      }
      await conversation.delete().catch(() => {});

      return res.status(200).json({ success: true });
    }

    // ---------- POST: ask King X AI ----------
    if (rateLimited(user.uid)) {
      throw httpError(429, 'You are sending messages too fast. Wait a moment and try again.');
    }

    const { message, conversationId: rawId, userName } = req.body || {};

    if (typeof message !== 'string' || !message.trim()) {
      throw httpError(400, 'Message is required');
    }
    if (message.length > 10000) {
      throw httpError(400, 'Message is too long');
    }

    const id = conversationId(rawId);
    const { conversation, messages } = refs(db, user.uid, id);

    const previous = await messages.orderBy('createdAt', 'desc').limit(20).get();
    const history = previous.docs.reverse().map((doc) => doc.data());

    // the name comes from the app (their King X name); fall back to the Google name on the login token
    const name = String(
      (typeof userName === 'string' && userName) || user.name || ''
    )
      .replace(/[\r\n]+/g, ' ')
      .trim()
      .slice(0, 60);

    const clean = message.trim();
    const reply = await generateReply(history, clean, { userName: name });

    // two different times, so the question always sorts before the answer
    const now = Date.now();
    const batch = db.batch();

    batch.set(messages.doc(), {
      role: 'user',
      text: clean,
      createdAt: Timestamp.fromMillis(now),
    });
    batch.set(messages.doc(), {
      role: 'model',
      text: reply,
      createdAt: Timestamp.fromMillis(now + 1),
    });
    batch.set(conversation, { updatedAt: FieldValue.serverTimestamp() }, { merge: true });

    await batch.commit();

    return res.status(200).json({ success: true, conversationId: id, reply });
  } catch (error) {
    const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 500;

    if (status >= 500) console.error('King X AI error:', error?.message || error);

    return res.status(status).json({
      error:
        status === 429 && !/too fast/.test(error.message || '')
          ? 'King X AI is busy right now. Please try again in a moment.'
          : status === 500
            ? 'King X AI encountered a server error'
            : error.message,
    });
  }
};
