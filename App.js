import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { Pacifico_400Regular } from '@expo-google-fonts/pacifico';

import { SettingsProvider, useTheme } from './src/context/SettingsContext';
import { AuthProvider } from './src/context/AuthContext';
import { AppDataProvider } from './src/context/AppDataContext';
import RootNavigator from './src/navigation/RootNavigator';
import useUpdateCheck from './src/hooks/useUpdateCheck';
import UpdateCard from './src/components/UpdateCard';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Shows the error on screen instead of a blank / stuck app
class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    const e = this.state.error;
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A0A', paddingTop: 60, paddingHorizontal: 16, paddingBottom: 20 }}>
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>Something went wrong</Text>
        <Text style={{ color: '#F5B700', marginTop: 6 }}>Send a screenshot of this screen to fix it.</Text>
        <ScrollView style={{ marginTop: 14 }}>
          <Text selectable style={{ color: '#fff', fontSize: 12 }}>{String((e && e.stack) || e)}</Text>
        </ScrollView>
      </View>
    );
  }
}

function Root() {
  const { isDark } = useTheme();
  const updateState = useUpdateCheck();
  return (
    <View style={{ flex: 1 }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <RootNavigator />
      <UpdateCard state={updateState} />
    </View>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Pacifico_400Regular,
  });
  const [timedOut, setTimedOut] = useState(false);

  // never wait forever for fonts
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 4000);
    return () => clearTimeout(t);
  }, []);

  const ready = fontsLoaded || !!fontError || timedOut;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <SettingsProvider>
          <AuthProvider>
            <AppDataProvider>
              <Root />
            </AppDataProvider>
          </AuthProvider>
        </SettingsProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
