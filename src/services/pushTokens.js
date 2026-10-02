import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotifications(meId) {
  try {
    if (!Device.isDevice) {
      console.log('KING X: Push notifications require a physical device.');
      return null;
    }

    // Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('messages', {
        name: 'Messages',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 150, 100, 150],
        sound: 'default',
        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
      });

      console.log('KING X: Notification channel created.');
    }

    // Check permission
    const existing = await Notifications.getPermissionsAsync();

    let status = existing.status;

    console.log('KING X: Existing notification permission:', status);

    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();

      status = requested.status;

      console.log('KING X: Requested notification permission:', status);
    }

    if (status !== 'granted') {
      console.log('KING X: Notification permission denied.');
      return null;
    }

    // Get native FCM token
    const { data: token } =
      await Notifications.getDevicePushTokenAsync();

    if (!token) {
      console.log('KING X: No FCM token received.');
      return null;
    }

    console.log('KING X: FCM TOKEN:', token);

    // Save token to Firestore
    if (meId) {
      await updateDoc(doc(db, 'users', meId), {
        pushToken: token,
        pushPlatform: Platform.OS,
        pushTokenUpdatedAt: new Date(),
      });

      console.log('KING X: Push token saved to Firestore.');
    }

    return token;
  } catch (error) {
    console.error(
      'KING X: Push registration failed:',
      error
    );

    return null;
  }
}