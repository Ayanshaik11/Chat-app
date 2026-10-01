import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';

import * as Notifications from 'expo-notifications';
import { SettingsProvider, useTheme } from './src/context/SettingsContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AppDataProvider } from './src/context/AppDataContext';
import RootNavigator from './src/navigation/RootNavigator';
import { navigateToChat } from './src/navigation/navigationRef';
import { registerForPushNotifications } from './src/services/pushTokens';
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
        <Text style={{ color: '#E11D2A', marginTop: 6 }}>Send a screenshot of this screen to fix it.</Text>
        <ScrollView style={{ marginTop: 14 }}>
          <Text selectable style={{ color: '#fff', fontSize: 12 }}>{String((e && e.stack) || e)}</Text>
        </ScrollView>
      </View>
    );
  }
}

function Root() {
  const { isDark } = useTheme();
  const { me } = useAuth();
  const updateState = useUpdateCheck();

  // Registers this device for push notifications once logged in, and keeps
  // the token fresh if it rotates while the app is open.
  useEffect(() => {
    if (me?.id) registerForPushNotifications(me.id).catch(() => {});
  }, [me?.id]);

  // Tapping a message notification jumps straight to that chat — the
  // notification's "data" payload (sent from the Vercel proxy) carries who
  // the message was from.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.type === 'message' && data?.fromId) {
        navigateToChat({ id: data.fromId, name: data.fromName || 'User', photoURL: data.fromPhoto || '' });
      }
    });
    return () => sub.remove();
  }, []);

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
    BebasNeue_400Regular,
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
