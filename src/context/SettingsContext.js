import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Vibration,
  useColorScheme,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  darkColors,
  fonts,
  gradient,
  lightColors,
} from '../theme';


const KEY = 'chatapp.settings.v1';


const defaults = {
  themeMode: 'dark',
  vibration: true,
  showOnline: true,
};


const SettingsContext =
  createContext(null);


export function SettingsProvider({
  children,
}) {
  const system = useColorScheme();

  const [settings, setSettings] =
    useState(defaults);

  const [loaded, setLoaded] =
    useState(false);


  /*
   * Load local settings.
   */
  useEffect(() => {
    AsyncStorage
      .getItem(KEY)
      .then((value) => {
        if (!value) {
          return;
        }

        try {
          const saved =
            JSON.parse(value);

          setSettings({
            ...defaults,
            ...saved,
          });
        } catch {}
      })
      .catch(() => {})
      .finally(() => {
        setLoaded(true);
      });
  }, []);


  /*
   * Local settings.
   *
   * Used for:
   * - theme
   * - vibration
   *
   * Activity status is handled by
   * AuthContext + Firestore.
   */
  const setSetting = useCallback(
    (key, value) => {
      setSettings((previous) => {
        const next = {
          ...previous,
          [key]: value,
        };

        /*
         * Don't use local storage as the
         * source of truth for activity status.
         */
        if (key !== 'showOnline') {
          AsyncStorage
            .setItem(
              KEY,
              JSON.stringify(next)
            )
            .catch(() => {});
        }

        return next;
      });
    },
    []
  );


  const setLocalSetting = useCallback(
    (key, value) => {
      setSettings((previous) => {
        const next = {
          ...previous,
          [key]: value,
        };

        AsyncStorage
          .setItem(
            KEY,
            JSON.stringify(next)
          )
          .catch(() => {});

        return next;
      });
    },
    []
  );


  const isDark =
    settings.themeMode === 'system'
      ? system === 'dark'
      : settings.themeMode === 'dark';


  const vibrate = useCallback(
    (pattern = 40) => {
      if (settings.vibration) {
        Vibration.vibrate(pattern);
      }
    },
    [settings.vibration]
  );


  const theme = useMemo(
    () => ({
      isDark,
      colors: isDark
        ? darkColors
        : lightColors,
      fonts,
      gradient,
    }),
    [isDark]
  );


  const value = useMemo(
    () => ({
      settings,

      setSetting,

      setLocalSetting,

      vibrate,

      theme,
    }),
    [
      settings,
      setSetting,
      setLocalSetting,
      vibrate,
      theme,
    ]
  );


  if (!loaded) {
    return null;
  }


  return (
    <SettingsContext.Provider
      value={value}
    >
      {children}
    </SettingsContext.Provider>
  );
}


export const useSettings = () =>
  useContext(SettingsContext);


export const useTheme = () =>
  useContext(SettingsContext).theme;