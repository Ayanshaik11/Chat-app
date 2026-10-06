import {
  addDoc,
  collection,
  doc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';

import { db } from '../config/firebase';
import { PROXY_API_URL } from '../config/proxy';

/*
 * Full URL of your deployed Vercel notification API.
 *
 * Example:
 * EXPO_PUBLIC_NOTIFICATION_API_URL=https://your-project.vercel.app/api/send-notification
 *
 * Do NOT use a relative URL such as /api/send-notification
 * because React Native does not resolve it like a browser.
 */
const NOTIFICATION_API_URL =
  process.env.EXPO_PUBLIC_NOTIFICATION_API_URL ||
  `${PROXY_API_URL}/api/send-notification`;

/**
 * Send a push notification through the Vercel FCM proxy.
 *
 * This is separate from the Firestore notification.
 */
export async function sendPushNotification({
  toUserId,
  title,
  body,
  data = {},
}) {
  if (!toUserId || !body) {
    console.warn(
      'KING X: Push notification skipped - missing toUserId or body.'
    );
    return {
      sent: false,
      reason: 'missing_data',
    };
  }

  if (!NOTIFICATION_API_URL) {
    console.warn(
      'KING X: EXPO_PUBLIC_NOTIFICATION_API_URL is not configured.'
    );

    return {
      sent: false,
      reason: 'missing_api_url',
    };
  }

  try {
    console.log(
      'KING X: Sending push notification to:',
      toUserId
    );

    const response = await fetch(NOTIFICATION_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        toUserId,
        title: title || 'King X',
        body,
        data,
      }),
    });

    const text = await response.text();

    let result = {};

    try {
      result = text ? JSON.parse(text) : {};
    } catch {
      result = {
        raw: text,
      };
    }

    if (!response.ok) {
      console.error(
        'KING X: Push API failed:',
        response.status,
        result
      );

      return {
        sent: false,
        reason: 'api_error',
        status: response.status,
        result,
      };
    }

    console.log(
      'KING X: Push API response:',
      result
    );

    return result;
  } catch (error) {
    console.error(
      'KING X: Push request failed:',
      error
    );

    return {
      sent: false,
      reason: 'network_error',
      error: error?.message || String(error),
    };
  }
}

/**
 * Add an in-app notification to Firestore.
 *
 * Then also try to send an Android push notification.
 */
export async function addNotification(userId, data) {
  if (!userId) {
    throw new Error(
      'Cannot add notification without userId.'
    );
  }

  const notificationData = {
    read: false,
    createdAt: serverTimestamp(),
    ...data,
  };

  /*
   * 1. Save notification to Firestore.
   */
  const notificationRef = await addDoc(
    collection(db, 'users', userId, 'notifications'),
    notificationData
  );

  console.log(
    'KING X: In-app notification created:',
    notificationRef.id
  );

  /*
   * 2. Send Android push notification.
   *
   * We intentionally do not throw if push fails.
   * The Firestore notification should still remain.
   */
  const pushResult = await sendPushNotification({
    toUserId: userId,
    title: data?.title || getDefaultTitle(data?.type),
    body: data?.text || data?.body || 'You have a new notification.',
    data: {
      type: data?.type || 'general',
      notificationId: notificationRef.id,
      // Used by App.js to open the right chat when the notification is tapped
      ...(data?.fromId ? { fromId: data.fromId } : {}),
      ...(data?.fromName ? { fromName: data.fromName } : {}),
      ...(data?.fromPhoto ? { fromPhoto: data.fromPhoto } : {}),
    },
  });

  return {
    id: notificationRef.id,
    push: pushResult,
  };
}

/**
 * Default titles for King X system notifications.
 */
function getDefaultTitle(type) {
  switch (type) {
    case 'login':
      return 'King X Login';

    case 'logout':
      return 'King X Logout';

    case 'message':
      return 'New Message';

    case 'like':
      return 'New Like';

    case 'comment':
      return 'New Comment';

    case 'follow':
      return 'New Follower';

    default:
      return 'King X';
  }
}

/**
 * Mark all unread notifications as read.
 */
export async function markAllRead(userId, list) {
  if (!userId || !Array.isArray(list)) {
    return;
  }

  const unread = list
    .filter((n) => !n.read)
    .slice(0, 400);

  if (!unread.length) {
    return;
  }

  const batch = writeBatch(db);

  unread.forEach((n) => {
    batch.update(
      doc(
        db,
        'users',
        userId,
        'notifications',
        n.id
      ),
      {
        read: true,
      }
    );
  });

  await batch.commit();

  console.log(
    'KING X: Marked notifications as read:',
    unread.length
  );
}

/**
 * Delete all notifications.
 */
export async function clearAllNotifications(userId, list) {
  if (!userId || !Array.isArray(list)) {
    return;
  }

  const items = list.slice(0, 400);

  if (!items.length) {
    return;
  }

  const batch = writeBatch(db);

  items.forEach((n) => {
    batch.delete(
      doc(
        db,
        'users',
        userId,
        'notifications',
        n.id
      )
    );
  });

  await batch.commit();

  console.log(
    'KING X: Cleared notifications:',
    items.length
  );
}