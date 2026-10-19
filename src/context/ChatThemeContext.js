import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_THEME_ID, resolveThemeId } from '../utils/chatTheme';
import {
  clearStoredChatTheme,
  getStoredDefaultThemeId,
  getStoredThemes,
  setStoredChatTheme,
  setStoredDefaultThemeId,
} from '../services/chatThemeStore';

/*
 * Holds the per-conversation wallpaper choice in memory (loaded once from
 * AsyncStorage) so the chat can render the right theme immediately and without
 * re-rendering the whole screen when a theme changes.
 */

const ChatThemeContext = createContext(null);

export function ChatThemeProvider({ children }) {
  const [byChat, setByChat] = useState({});
  const [defaultId, setDefaultId] = useState(DEFAULT_THEME_ID);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [map, def] = await Promise.all([getStoredThemes(), getStoredDefaultThemeId()]);
      if (!alive) return;
      setByChat(map || {});
      setDefaultId(resolveThemeId(def || DEFAULT_THEME_ID));
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const themeIdFor = useCallback(
    (chatId) => resolveThemeId((chatId && byChat[chatId]) || defaultId || DEFAULT_THEME_ID),
    [byChat, defaultId]
  );

  const applyTheme = useCallback(async (chatId, themeId) => {
    if (!chatId || !themeId) return;
    const resolved = resolveThemeId(themeId);
    setByChat((prev) => ({ ...prev, [chatId]: resolved }));
    await setStoredChatTheme(chatId, resolved);
  }, []);

  const resetTheme = useCallback(async (chatId) => {
    if (!chatId) return;
    setByChat((prev) => {
      if (!(chatId in prev)) return prev;
      const next = { ...prev };
      delete next[chatId];
      return next;
    });
    await clearStoredChatTheme(chatId);
  }, []);

  const makeDefault = useCallback(async (themeId) => {
    const next = resolveThemeId(themeId || DEFAULT_THEME_ID);
    setDefaultId(next);
    await setStoredDefaultThemeId(next === DEFAULT_THEME_ID ? null : next);
  }, []);

  const value = useMemo(
    () => ({ loaded, byChat, defaultId, themeIdFor, applyTheme, resetTheme, makeDefault }),
    [loaded, byChat, defaultId, themeIdFor, applyTheme, resetTheme, makeDefault]
  );

  return <ChatThemeContext.Provider value={value}>{children}</ChatThemeContext.Provider>;
}

export const useChatTheme = () => {
  const ctx = useContext(ChatThemeContext);
  if (!ctx) throw new Error('useChatTheme must be used inside <ChatThemeProvider>');
  return ctx;
};

export default ChatThemeContext;
