import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { palettes } from "../theme";
import { getFeedbackSettings, loadFeedbackSettings, saveFeedbackSettings } from "./feedback";

const THEME_KEY = "chat.theme"; // "dark" | "light" | "system"

const AppContext = createContext(null);

export function AppProvider({ children, profile, firebaseUser }) {
  const [themeChoice, setThemeChoice] = useState("dark");
  const [systemScheme, setSystemScheme] = useState(Appearance.getColorScheme() || "dark");
  const [settings, setSettings] = useState(getFeedbackSettings());

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((value) => {
      if (value) setThemeChoice(value);
    });
    loadFeedbackSettings().then(setSettings);

    const sub = Appearance.addChangeListener(({ colorScheme }) => setSystemScheme(colorScheme || "dark"));
    return () => sub.remove();
  }, []);

  const resolved = themeChoice === "system" ? systemScheme : themeChoice;
  const colors = palettes[resolved === "light" ? "light" : "dark"];

  const value = useMemo(
    () => ({
      colors,
      theme: resolved,
      themeChoice,
      profile,
      firebaseUser,
      settings,
      async setTheme(choice) {
        setThemeChoice(choice);
        await AsyncStorage.setItem(THEME_KEY, choice);
      },
      async setSetting(key, on) {
        setSettings(await saveFeedbackSettings({ [key]: on }));
      }
    }),
    [colors, resolved, themeChoice, profile, firebaseUser, settings]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used inside AppProvider");
  return value;
}

export function useColors() {
  return useApp().colors;
}
