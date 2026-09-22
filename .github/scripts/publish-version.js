// Writes config/appVersion in Firestore so the app's in-app update check
// finds it. Only runs from the "Publish Release" workflow — never on
// ordinary small-change builds.
const admin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function main() {
  const version = process.env.RELEASE_VERSION;
  const url = process.env.RELEASE_URL;
  const notes = process.env.RELEASE_NOTES || '';
  if (!version || !url) throw new Error('RELEASE_VERSION and RELEASE_URL are required');
  await db.collection('config').doc('appVersion').set({ latestVersion: version, url, notes }, { merge: true });
  console.log(`config/appVersion updated -> ${version} (${url})`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
