'use strict';

/*
 * KING X — shared Firebase Admin helper.
 *
 * Initialises the Admin SDK once per serverless instance from the
 * FIREBASE_SERVICE_ACCOUNT env var (the same variable the existing
 * `send-notification` and `youtube-shorts` routes already use) and verifies the
 * Firebase ID token a client sends in the Authorization header.
 */

const admin = require('firebase-admin');

let app = null;

function getFirebaseApp() {
  if (app) return app;

  if (admin.apps.length) {
    app = admin.app();
    return app;
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    const error = new Error('FIREBASE_SERVICE_ACCOUNT is not configured.');
    error.status = 500;
    throw error;
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(raw);
  } catch {
    const error = new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON.');
    error.status = 500;
    throw error;
  }

  app = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  return app;
}

/** Pull the raw token out of an `Authorization: Bearer <token>` header. */
function extractBearer(header) {
  if (typeof header !== 'string') return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

/**
 * Verify the request's Firebase ID token.
 *
 * @returns {Promise<object>} the decoded token (contains `uid`, `email`, ...)
 * @throws {Error & { status?: number }} 401 when the header is missing or the
 *   token is invalid/expired.
 */
async function verifyFirebaseIdToken(req) {
  const header = req?.headers?.authorization || req?.headers?.Authorization;
  const token = extractBearer(header);

  if (!token) {
    const error = new Error('Missing Authorization bearer token.');
    error.status = 401;
    throw error;
  }

  try {
    return await getFirebaseApp().auth().verifyIdToken(token);
  } catch {
    const error = new Error('Invalid or expired authentication token.');
    error.status = 401;
    throw error;
  }
}

module.exports = { getFirebaseApp, extractBearer, verifyFirebaseIdToken };
