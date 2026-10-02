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
   * Load local settings
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
   * Change local settings.
   *
   * Theme and vibration are stored
   * on this device.
   *
   * Activity Status is NOT stored here.
   * It is stored in Firestore by AuthContext.
   */
  const setSetting = useCallback(
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


  /*
   * Theme
   */
  const isDark =
    settings.themeMode === 'system'
      ? system === 'dark'
      : settings.themeMode === 'dark';


  /*
   * Vibration
   */
  const vibrate = useCallback(
    (pattern = 40) => {
      if (settings.vibration) {
        Vibration.vibrate(pattern);
      }
    },
    [settings.vibration]
  );


  /*
   * Theme object
   */
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


  /*
   * Context value
   */
  const value = useMemo(
    () => ({
      settings,

      setSetting,

      vibrate,

      theme,
    }),
    [
      settings,
      setSetting,
      vibrate,
      theme,
    ]
  );


  /*
   * Wait until AsyncStorage has loaded.
   */
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