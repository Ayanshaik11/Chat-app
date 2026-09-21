import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { Pacifico_400Regular } from '@expo-google-fonts/pacifico';

import { SettingsProvider, useTheme } from './src/context/SettingsContext';
import { AuthProvider } from './src/context/AuthContext';
import { AppDataProvider } from './src/context/AppDataContext';
import RootNavigator from './src/navigation/RootNavigator';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Root() {
  const { isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <RootNavigator />
    </>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Pacifico_400Regular,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <AuthProvider>
          <AppDataProvider>
            <Root />
          </AppDataProvider>
        </AuthProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
