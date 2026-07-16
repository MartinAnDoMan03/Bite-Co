import axios from 'axios';

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