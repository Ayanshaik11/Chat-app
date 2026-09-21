import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'chatapp.seenStories.v1';

export async function getSeen() {
  try {
    return JSON.parse((await AsyncStorage.getItem(KEY)) || '{}');
  } catch {
    return {};
  }
}

export async function markSeen(ids) {
  try {
    const seen = await getSeen();
    const now = Date.now();
    ids.forEach((id) => (seen[id] = now));
    const cutoff = now - 48 * 3600 * 1000;
    Object.keys(seen).forEach((k) => {
      if (seen[k] < cutoff) delete seen[k];
    });
    await AsyncStorage.setItem(KEY, JSON.stringify(seen));
  } catch {}
}
