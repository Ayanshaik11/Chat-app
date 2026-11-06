// Publishes release information exclusively to the new King X Android channel.
const admin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function main() {
  const version = process.env.RELEASE_VERSION;
  const url = process.env.RELEASE_URL;
  const notes = process.env.RELEASE_NOTES || '';

  if (!version || !url) {
    throw new Error('RELEASE_VERSION and RELEASE_URL are required');
  }

  const documentId = 'appVersion-com-aiyan-kingx';

  await db.collection('config').doc(documentId).set({
    latestVersion: version,
    url,
    notes,
    androidPackage: 'com.aiyan.kingx',
  }, { merge: true });

  console.log(`Updated ${documentId} -> ${version}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
