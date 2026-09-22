import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { CURRENT_VERSION } from '../config/appVersion';

const parts = (v) => String(v || '0').split('.').map((n) => parseInt(n, 10) || 0);

// true if "a" is a newer version than "b", e.g. isNewer('1.2.0', '1.1.9') -> true
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

// Reads config/appVersion from Firestore:
//   latestVersion (string, required)  e.g. "1.1.0"
//   url           (string)            link to download the new APK
//   notes         (string, optional)  short "what's new" text
//   minVersion    (string, optional)  if set, versions below this must update
export async function fetchUpdateInfo() {
  try {
    const snap = await getDoc(doc(db, 'config', 'appVersion'));
    if (!snap.exists()) return null;
    const data = snap.data();
    if (!data.latestVersion || !isNewer(data.latestVersion, CURRENT_VERSION)) return null;
    return {
      latestVersion: data.latestVersion,
      url: data.url || '',
      notes: data.notes || '',
      forced: !!data.minVersion && isNewer(data.minVersion, CURRENT_VERSION),
    };
  } catch {
    return null; // e.g. offline — fail silently, never block the app
  }
}
