import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import {
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';

import { db } from '../config/firebase';

/*
 * Notification behaviour when the app is in the foreground.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Register this physical device for FCM push notifications.
 */
export async function registerForPushNotifications(meId) {
  try {
    console.log(
      'KING X: Starting push notification registration.'
    );

    if (!Device.isDevice) {
      console.log(
        'KING X: Push notifications require a physical device.'
      );

      return null;
    }

    /*
     * Android notification channel.
     */
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(
        'messages',
        {
          name: 'King X Notifications',
          description:
            'Messages and other King X notifications.',
          importance:
            Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 150, 100, 150],
          sound: 'default',
          lockscreenVisibility:
            Notifications.AndroidNotificationVisibility.PUBLIC,
        }
      );

      console.log(
        'KING X: Notification channel created.'
      );
    }

    /*
     * Check existing permission.
     */
    const existing =
      await Notifications.getPermissionsAsync();

    let status = existing.status;

    console.log(
      'KING X: Existing notification permission:',
      status
    );

    /*
     * Ask for permission if necessary.
     */
    if (status !== 'granted') {
      const requested =
        await Notifications.requestPermissionsAsync();

      status = requested.status;

      console.log(
        'KING X: Requested notification permission:',
        status
      );
    }

    if (status !== 'granted') {
      console.log(
        'KING X: Notification permission denied.'
      );

      return null;
    }

    /*
     * Get the native FCM/APNs device token.
     */
    const result =
      await Notifications.getDevicePushTokenAsync();

    const token = result?.data;

    if (!token) {
      console.log(
        'KING X: No native push token received.'
      );

      return null;
    }

    console.log(
      'KING X: FCM/native push token received.'
    );

    /*
     * Save the token to the user's Firestore document.
     */
    if (meId) {
      await updateDoc(
        doc(db, 'users', meId),
        {
          pushToken: token,
          pushPlatform: Platform.OS,
          pushTokenUpdatedAt: serverTimestamp(),
        }
      );

      console.log(
        'KING X: Push token saved to Firestore.'
      );
    } else {
      console.log(
        'KING X: No user ID supplied, token was not saved.'
      );
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