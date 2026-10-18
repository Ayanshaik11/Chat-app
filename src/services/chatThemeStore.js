import AsyncStorage from '@react-native-async-storage/async-storage';

/*
 * Local, per-conversation theme cache.
 *
 * The authoritative (shared) theme lives on the Firestore chat document
 * (`chats/{chatId}.theme`) so both participants see the same one. This cache
 * makes the chosen theme show instantly on open and survive a restart even when
 * the device is offline, without waiting for the Firestore snapshot.
 */

const CHAT_KEY = 'kx_chat_themes_v1';
const DEFAULT_KEY = 'kx_chat_theme_default_v1';

export async function getStoredThemes() {
  try {
    const raw = await AsyncStorage.getItem(CHAT_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function getStoredChatTheme(chatId) {
  if (!chatId) return null;
  const map = await getStoredThemes();
  return map[chatId] || null;
}

export async function setStoredChatTheme(chatId, themeId) {
  if (!chatId || !themeId) return;
  try {
    const map = await getStoredThemes();
    map[chatId] = themeId;
    await AsyncStorage.setItem(CHAT_KEY, JSON.stringify(map));
  } catch {
    /* storage full / unavailable — the remote value still applies */
  }
}

export async function clearStoredChatTheme(chatId) {
  if (!chatId) return;
  try {
    const map = await getStoredThemes();
    if (chatId in map) {
      delete map[chatId];
      await AsyncStorage.setItem(CHAT_KEY, JSON.stringify(map));
    }
  } catch {
    /* ignore */
  }
}

export async function getStoredDefaultThemeId() {
  try {
    return (await AsyncStorage.getItem(DEFAULT_KEY)) || null;
  } catch {
    return null;
  }
}

export async function setStoredDefaultThemeId(themeId) {
  try {
    if (themeId) await AsyncStorage.setItem(DEFAULT_KEY, themeId);
    else await AsyncStorage.removeItem(DEFAULT_KEY);
  } catch {
    /* ignore */
  }
}
