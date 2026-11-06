import { doc, getDoc, getDocFromServer } from 'firebase/firestore';
import { db } from '../config/firebase';
import { CURRENT_VERSION } from '../config/appVersion';

const parts = (v) =>
  String(v || '0')
    .replace(/^v/i, '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);

export function isNewer(a, b) {
  const pa = parts(a);
  const pb = parts(b);

  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x > y;
  }

  return false;
}

// Reads config/appVersion straight from the server (never a stale cached copy).
// Throws when the network is not ready, so the caller can retry.
async function readAppVersionDoc() {
  try {
    return await getDocFromServer(doc(db, 'config', 'appVersion'));
  } catch (e) {
    // offline right now: fall back to whatever is cached, but only if there is something
    const cached = await getDoc(doc(db, 'config', 'appVersion'));
    if (cached.exists()) return cached;
    throw e;
  }
}

// Returns { checked, info }
//  - checked=false : could not reach Firestore (caller should try again later)
//  - checked=true, info=null : app is up to date (or no release published)
//  - checked=true, info={...} : a newer version exists
export async function checkForUpdate() {
  let snap;

  try {
    snap = await readAppVersionDoc();
  } catch (e) {
    console.warn('KING X: update check failed:', e?.code || e?.message || e);
    return { checked: false, info: null };
  }

  if (!snap.exists()) return { checked: true, info: null };

  const data = snap.data() || {};
  const latest = String(data.latestVersion || '').replace(/^v/i, '');

  if (!latest || !isNewer(latest, CURRENT_VERSION)) {
    return { checked: true, info: null };
  }

  return {
    checked: true,
    info: {
      latestVersion: latest,
      url: data.url || '',
      notes: data.notes || '',
      forced: !!data.minVersion && isNewer(data.minVersion, CURRENT_VERSION),
    },
  };
}

// kept for any older imports
export async function fetchUpdateInfo() {
  return (await checkForUpdate()).info;
}
