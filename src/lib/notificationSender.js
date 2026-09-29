import axios from 'axios';
import { getMessaging } from 'firebase-admin/messaging';
import { app } from '@/firebase/configure';

const EXPO_API_URL = 'https://exp.host/--/api/v2/push/send';

export async function sendNotification(expoPushTokken, title, body, data = {}) {
    try {
        const message = {
            to: expoPushTokken,
            sound: 'default',
            title,
            body,
            data,
            badge: 1,
        };

        await axios.post(EXPO_API_URL, message, {
            headers: {
                Accept: 'application/json',
                'Accecpt-Encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
        });

        return true;
    } catch (error){
        console.error('Failed to send notification', error);
        return false;
    }
}

export async function sendWebPushNotification(fcmToken, title, body, data = {}) {
  try {
    const stringData = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)])
    );

    await getMessaging(app).send({
      token: fcmToken,
      notification: { title, body },
      data: stringData,
    });
    return true;
  } catch (error) {
    const isInvalidToken = [
      'messaging/invalid-registration-token',
      'messaging/registration-token-not-registered',
    ].includes(error.code);
    if (!isInvalidToken) {
      console.error('Failed to send web push notification', error);
    }
    return isInvalidToken ? 'invalid-token' : false;
  }
}