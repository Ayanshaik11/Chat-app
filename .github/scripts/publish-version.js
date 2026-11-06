// Publishes release information to the King X update channel (Firestore config/appVersion).
const admin = require('firebase-admin');

// The app reads this Firebase project. The key in the FIREBASE_SERVICE_ACCOUNT secret
// MUST belong to the same project, otherwise the in-app update popup never appears.
const APP_PROJECT_ID = process.env.APP_FIREBASE_PROJECT_ID || 'chat-app-652fc';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

if (serviceAccount.project_id !== APP_PROJECT_ID) {
  throw new Error(
    `FIREBASE_SERVICE_ACCOUNT is for project "${serviceAccount.project_id}" but the app uses "${APP_PROJECT_ID}". ` +
      'Create a new key in the correct Firebase project (Project settings > Service accounts) and update the GitHub secret.'
  );
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function main() {
  const version = String(process.env.RELEASE_VERSION || '').replace(/^v/i, '');
  const url = process.env.RELEASE_URL;
  const notes = process.env.RELEASE_NOTES || '';

  if (!version || !url) {
    throw new Error('RELEASE_VERSION and RELEASE_URL are required');
  }

  const ref = db.collection('config').doc('appVersion');
  await ref.set({ latestVersion: version, url, notes }, { merge: true });

  const check = (await ref.get()).data() || {};
  if (check.latestVersion !== version) {
    throw new Error('Write did not stick: config/appVersion.latestVersion is ' + check.latestVersion);
  }

  console.log(`config/appVersion updated in project ${serviceAccount.project_id} -> ${version} (${url})`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
