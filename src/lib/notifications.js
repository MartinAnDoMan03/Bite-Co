import { db } from '@/firebase/configure';
import { sendNotification } from './notificationSender';

// Writes a Firestore notification record (for the in-app bell/list) and,
// if the recipient has a registered push token, sends an Expo push too.
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
    const userDoc = await db.collection(collectionName).doc(userId).get();
    const expoPushToken = userDoc.exists ? userDoc.data().expoPushToken : null;
    if (expoPushToken) {
      await sendNotification(expoPushToken, title, message, data);
    }
  } catch (error) {
    console.error(`Error sending ${userType} push notification:`, error);
  }
}