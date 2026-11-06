import { doc, getDoc } from 'firebase/firestore';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { db } from '../config/firebase';
import { CURRENT_VERSION } from '../config/appVersion';

const parts = (v) => String(v || '0').split('.').map((n) => parseInt(n, 10) || 0);

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

export async function fetchUpdateInfo() {
  try {
    const packageName = Constants.expoConfig?.android?.package;

    // Only the new Android package uses the new update channel.
    // Old Android users and iOS retain the existing channel.
    const documentId =
      Platform.OS === 'android' && packageName === 'com.aiyan.kingx'
        ? 'appVersion-com-aiyan-kingx'
        : 'appVersion';

    const snap = await getDoc(doc(db, 'config', documentId));

    if (!snap.exists()) return null;

    const data = snap.data();

    if (!data.latestVersion || !isNewer(data.latestVersion, CURRENT_VERSION)) {
      return null;
    }

    return {
      latestVersion: data.latestVersion,
      url: data.url || '',
      notes: data.notes || '',
      forced: !!data.minVersion && isNewer(data.minVersion, CURRENT_VERSION),
    };
  } catch {
    return null;
  }
}
