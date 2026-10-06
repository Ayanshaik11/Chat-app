const admin = require('firebase-admin');

function getAdmin() {
  if (admin.apps.length) {
    return admin.app();
  }

  const rawServiceAccount =
    process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!rawServiceAccount) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT is not configured.'
    );
  }

  let serviceAccount;

  try {
    serviceAccount =
      JSON.parse(rawServiceAccount);
  } catch (error) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT is not valid JSON.'
    );
  }

  return admin.initializeApp({
    credential:
      admin.credential.cert(serviceAccount),
  });
}

module.exports = async (req, res) => {
  /*
   * Only POST is allowed.
   */
  if (req.method !== 'POST') {
    res.status(405).json({
      error: 'Use POST',
    });

    return;
  }

  try {
    const {
      toUserId,
      title,
      body,
      data,
    } = req.body || {};

    if (!toUserId || !body) {
      res.status(400).json({
        error:
          'toUserId and body are required',
      });

      return;
    }

    const app = getAdmin();

    const db = app.firestore();

    /*
     * Get target user.
     */
    const userRef =
      db.collection('users').doc(toUserId);

    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      res.status(404).json({
        sent: false,
        reason: 'User not found',
      });

      return;
    }

    const userData = userDoc.data() || {};

    const token = userData.pushToken;

    /*
     * User has not registered a device token yet.
     */
    if (!token) {
      console.log(
        'No push token for user:',
        toUserId
      );

      res.status(200).json({
        sent: false,
        reason:
          'No push token on file for this user',
      });

      return;
    }

    /*
     * FCM data values must be strings.
     */
    const stringData = Object.fromEntries(
      Object.entries(data || {}).map(
        ([key, value]) => [
          key,
          String(value),
        ]
      )
    );

    /*
     * Send FCM notification.
     */
    const messageId =
      await app.messaging().send({
        token,

        notification: {
          title: title || 'King X',
          body,
        },

        data: stringData,

        android: {
          priority: 'high',

          notification: {
            channelId: 'messages',
            sound: 'default',
            priority: 'high',
          },
        },
      });

    console.log(
      'FCM notification sent:',
      messageId
    );

    res.status(200).json({
      sent: true,
      messageId,
    });
  } catch (error) {
    console.error(
      'send-notification error:',
      error
    );

    /*
     * If FCM says the token is invalid,
     * remove it from Firestore so we don't
     * repeatedly try using a dead token.
     */
    const code =
      error?.errorInfo?.code ||
      error?.code ||
      '';

    if (
      code ===
        'messaging/registration-token-not-registered' ||
      code ===
        'messaging/invalid-registration-token'
    ) {
      try {
        const {
          toUserId,
        } = req.body || {};

        if (toUserId) {
          const app = getAdmin();

          await app
            .firestore()
            .collection('users')
            .doc(toUserId)
            .update({
              pushToken:
                admin.firestore.FieldValue.delete(),
              pushTokenUpdatedAt:
                admin.firestore.FieldValue.serverTimestamp(),
            });

          console.log(
            'KING X: Removed invalid push token.'
          );
        }
      } catch (cleanupError) {
        console.error(
          'KING X: Failed to remove invalid token:',
          cleanupError
        );
      }
    }

    res.status(500).json({
      sent: false,
      error:
        error?.message ||
        'Failed to send notification',
    });
  }
};