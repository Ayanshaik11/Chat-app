import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Vibration, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, fonts, gradient, lightColors } from '../theme';

const KEY = 'chatapp.settings.v1';
const defaults = { themeMode: 'dark', vibration: true, showOnline: true }; // King X reads best in dark+gold — light mode is still there in Settings

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const system = useColorScheme();
  const [settings, setSettings] = useState(defaults);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => v && setSettings({ ...defaults, ...JSON.parse(v) }))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const setSetting = useCallback((key, value) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const isDark = settings.themeMode === 'system' ? system === 'dark' : settings.themeMode === 'dark';

  const vibrate = useCallback(
    (pattern = 40) => {
      if (settings.vibration) Vibration.vibrate(pattern);
    },
    [settings.vibration]
  );

  const theme = useMemo(
    () => ({ isDark, colors: isDark ? darkColors : lightColors, fonts, gradient }),
    [isDark]
  );

  const value = useMemo(() => ({ settings, setSetting, vibrate, theme }), [settings, setSetting, vibrate, theme]);

  if (!loaded) return null;
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => useContext(SettingsContext);
export const useTheme = () => useContext(SettingsContext).theme;
