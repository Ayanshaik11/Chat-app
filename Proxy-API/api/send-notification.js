// Vercel serverless function — sends a real push notification via Firebase
// Cloud Messaging. Reuses the same FIREBASE_SERVICE_ACCOUNT credential
// already set up for the release-notification script, just added here too
// as a Vercel Environment Variable (Vercel and GitHub Actions each need
// their own copy of the secret — they don't share one).
const admin = require('firebase-admin');

function getAdmin() {
  if (admin.apps.length) return admin.app();
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  return admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Use POST' });
    return;
  }

  try {
    const { toUserId, title, body, data } = req.body || {};
    if (!toUserId || !body) {
      res.status(400).json({ error: 'toUserId and body are required' });
      return;
    }

    const app = getAdmin();
    const db = app.firestore();

    const userDoc = await db.collection('users').doc(toUserId).get();
    const token = userDoc.data()?.pushToken;
    if (!token) {
      // Not an error — the recipient just hasn't registered a device yet
      // (e.g. notifications permission denied, or never opened the app).
      res.status(200).json({ sent: false, reason: 'No push token on file for this user' });
      return;
    }

    await app.messaging().send({
      token,
      notification: { title: title || 'New message', body },
      data: Object.fromEntries(Object.entries(data || {}).map(([k, v]) => [k, String(v)])),
      android: { priority: 'high', notification: { channelId: 'messages' } },
    });

    res.status(200).json({ sent: true });
  } catch (error) {
    console.error('send-notification error:', error);
    res.status(500).json({ error: error.message || 'Failed to send notification' });
  }
};
