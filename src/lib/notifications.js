import { db } from '@/firebase/configure';
import { sendNotification, sendWebPushNotification } from './notificationSender';

// Writes a Firestore notification record (for the in-app bell/list) and,
// if the recipient has a registered push token, sends a push too — Expo
// for the native app, FCM web push for the web build. A user can have
// both registered at once (e.g. logged in on phone and on web).
// userType: 'seller' | 'buyer'
export async function notifyUser({ userType, userId, type, title, message, data = {} }) {
  if (!userId) return;

  const idField = userType === 'seller' ? 'sellerId' : 'buyerId';

  try {
    await db.collection('notifications').add({
      [idField]: userId,
      type,
      title,
      message,
      data,
      isRead: false,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`Error saving ${userType} notification record:`, error);
  }

  try {
    const collectionName = userType === 'seller' ? 'sellers' : 'buyers';
    const userRef = db.collection(collectionName).doc(userId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return;

    const { expoPushToken, webPushToken } = userDoc.data();

    if (expoPushToken) {
      await sendNotification(expoPushToken, title, message, data);
    }

    if (webPushToken) {
      const result = await sendWebPushNotification(webPushToken, title, message, data);
      if (result === 'invalid-token') {
        await userRef.update({ webPushToken: null }).catch(() => {});
      }
    }
  } catch (error) {
    console.error(`Error sending ${userType} push notification:`, error);
  }
}

// Same idea, for the single shared admin account. There's no per-admin
// Firestore doc (admin login is one hardcoded username/password, not a
// user record), so push tokens live in their own collection — one doc per
// browser that's ever granted notification permission on the dashboard,
// keyed by the token itself so re-registering is a no-op.
export async function notifyAdmin({ type, title, message, data = {} }) {
  try {
    await db.collection('adminNotifications').add({
      type,
      title,
      message,
      data,
      isRead: false,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error saving admin notification record:', error);
  }

  try {
    const tokensSnap = await db.collection('adminPushTokens').get();
    await Promise.all(tokensSnap.docs.map(async (doc) => {
      const result = await sendWebPushNotification(doc.id, title, message, data);
      if (result === 'invalid-token') {
        await doc.ref.delete().catch(() => {});
      }
    }));
  } catch (error) {
    console.error('Error sending admin push notification:', error);
  }
}