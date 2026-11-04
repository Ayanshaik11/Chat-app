'use strict';

const { getFirebaseApp, verifyUser } = require('../lib/firebase');
const { generateReply } = require('../lib/gemini');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await verifyUser(req);

    const { message, conversationId } = req.body || {};

    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (message.length > 10000) {
      return res.status(400).json({ error: 'Message is too long' });
    }

    const id = conversationId || 'main';

    if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) {
      return res.status(400).json({ error: 'Invalid conversation ID' });
    }

    const db = getFirebaseApp().firestore();

    const messagesRef = db
      .collection('kingXAIUsers')
      .doc(user.uid)
      .collection('conversations')
      .doc(id)
      .collection('messages');

    const previous = await messagesRef
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    const history = previous.docs
      .reverse()
      .map(doc => doc.data())
      .filter(item =>
        ['user', 'model'].includes(item.role) &&
        typeof item.text === 'string'
      );

    const reply = await generateReply(history, message.trim());

    const batch = db.batch();

    batch.set(messagesRef.doc(), {
      role: 'user',
      text: message.trim(),
      createdAt: require('firebase-admin').firestore.FieldValue.serverTimestamp()
    });

    batch.set(messagesRef.doc(), {
      role: 'model',
      text: reply,
      createdAt: require('firebase-admin').firestore.FieldValue.serverTimestamp()
    });

    batch.set(
      db.collection('kingXAIUsers').doc(user.uid)
        .collection('conversations').doc(id),
      {
        updatedAt: require('firebase-admin').firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    await batch.commit();

    return res.status(200).json({
      success: true,
      conversationId: id,
      reply
    });

  } catch (error) {
    const status = error.status || 500;

    return res.status(status).json({
      error: status === 500
        ? 'King X AI encountered a server error'
        : error.message
    });
  }
};
