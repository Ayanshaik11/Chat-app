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

/*
 * Error Boundary
 *
 * Shows the actual error instead of leaving the app on a blank screen.
 */
class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    const e = this.state.error;

    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#0A0A0A',
          paddingTop: 60,
          paddingHorizontal: 16,
          paddingBottom: 20,
        }}
      >
        <Text
          style={{
            color: '#fff',
            fontSize: 18,
            fontWeight: '700',
          }}
        >
          Something went wrong
        </Text>

        <Text
          style={{
            color: '#E11D2A',
            marginTop: 6,
          }}
        >
          Send a screenshot of this screen to fix it.
        </Text>

        <ScrollView
          style={{
            marginTop: 14,
          }}
        >
          <Text
            selectable
            style={{
              color: '#fff',
              fontSize: 12,
            }}
          >
            {String((e && e.stack) || e)}
          </Text>
        </ScrollView>
      </View>
    );
  }
}


/*
 * Root application component
 */
function Root() {
  const { isDark } = useTheme();
  const { me } = useAuth();
  const updateState = useUpdateCheck();

  /*
   * Register this device for push notifications
   * whenever a user is logged in.
   */
  useEffect(() => {
    if (!me?.id) {
      return;
    }

    console.log(
      'KING X: Registering push notifications for user:',
      me.id
    );

    registerForPushNotifications(me.id)
      .then((token) => {
        if (token) {
          console.log(
            'KING X: Push registration successful.'
          );

          console.log(
            'KING X: FCM token:',
            token
          );
        } else {
          console.log(
            'KING X: Push registration returned no token.'
          );
        }
      })
      .catch((error) => {
        console.error(
          'KING X: Push registration error:',
          error
        );
      });
  }, [me?.id]);


  /*
   * Handle notification taps.
   *
   * The Vercel notification API sends:
   *
   * type      = message
   * fromId    = sender ID
   * fromName  = sender name
   * fromPhoto = sender photo
   *
   * When the user taps the notification,
   * open that conversation.
   */
  useEffect(() => {
    const subscription =
      Notifications.addNotificationResponseReceivedListener(
        (response) => {
          try {
            const data =
              response.notification.request.content.data;

            console.log(
              'KING X: Notification tapped:',
              data
            );

            if (
              data?.type === 'message' &&
              data?.fromId
            ) {
              navigateToChat({
                id: data.fromId,
                name: data.fromName || 'User',
                photoURL: data.fromPhoto || '',
              });
            }
          } catch (error) {
            console.error(
              'KING X: Notification tap error:',
              error
            );
          }
        }
      );

    return () => {
      subscription.remove();
    };
  }, []);


  /*
   * Handle notifications received while
   * the app is already open.
   *
   * The notification handler itself is configured
   * inside pushTokens.js.
   */
  useEffect(() => {
    const subscription =
      Notifications.addNotificationReceivedListener(
        (notification) => {
          console.log(
            'KING X: Notification received:',
            notification
          );
        }
      );

    return () => {
      subscription.remove();
    };
  }, []);


  return (
    <View style={{ flex: 1 }}>
      <StatusBar
        style={isDark ? 'light' : 'dark'}
      />

      <RootNavigator />

      <UpdateCard state={updateState} />
    </View>
  );
}


/*
 * Main App
 */
export default function App() {
  const [
    fontsLoaded,
    fontError,
  ] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    BebasNeue_400Regular,
  });

  const [timedOut, setTimedOut] = useState(false);


  /*
   * Prevent the splash screen from staying forever
   * if fonts fail to load.
   */
  useEffect(() => {
    const timeout = setTimeout(() => {
      setTimedOut(true);
    }, 4000);

    return () => {
      clearTimeout(timeout);
    };
  }, []);


  const ready =
    fontsLoaded ||
    !!fontError ||
    timedOut;


  /*
   * Hide splash screen once the app is ready.
   */
  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);


  if (!ready) {
    return null;
  }


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

This version keeps your existing navigation/auth/update system intact, but it stops silently swallowing push-registration errors and logs both received notifications and notification taps.