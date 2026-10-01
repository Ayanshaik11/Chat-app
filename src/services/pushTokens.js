import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

// Shows a heads-up banner + sound even while the app is open, same as most
// chat apps do for messages that arrive while you're already in the app.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Call once after login — asks permission, gets this device's push token,
// and saves it on the user's profile so other people's messages can reach it.
export async function registerForPushNotifications(meId) {
  if (!Device.isDevice) return null; // push tokens don't work on simulators

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Messages',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 150, 100, 150],
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== 'granted') return null;

  try {
    const { data: token } = await Notifications.getDevicePushTokenAsync();
    if (token && meId) {
      await updateDoc(doc(db, 'users', meId), { pushToken: token, pushPlatform: Platform.OS });
    }
    return token;
  } catch (e) {
    console.warn('Could not get push token', e);
    return null;
  }
}
