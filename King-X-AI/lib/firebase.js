'use strict';

const admin = require('firebase-admin');

function getFirebaseApp() {
  if (admin.apps.length) {
    return admin.app();
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is missing');
  }

  let serviceAccount;

  try {
    serviceAccount = JSON.parse(raw);
  } catch {
    throw new Error('Invalid Firebase service account JSON');
  }

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

async function verifyUser(req) {
  const header = req.headers?.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);

  if (!match) {
    const error = new Error('Authentication required');
    error.status = 401;
    throw error;
  }

  try {
    const app = getFirebaseApp();
    return await app.auth().verifyIdToken(match[1].trim());
  } catch {
    const error = new Error('Invalid or expired login session');
    error.status = 401;
    throw error;
  }
}

module.exports = { getFirebaseApp, verifyUser };
