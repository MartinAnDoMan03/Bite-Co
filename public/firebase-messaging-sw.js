importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// Same values as src/lib/firebase.js's firebaseConfig. A service worker
// can't read process.env, so these are duplicated here — none of them are
// secret, they're already shipped in your client bundle either way.
// Copy the exact object from src/lib/firebase.js (or your .env.local) —
// the apiKey is very likely the same one already committed in the mobile
// repo's firebase.js, since it's the same Firebase project:
// AIzaSyDnuqf_vlk9eit4bMUb6rw9ccYPlC01lVQ
firebase.initializeApp({
  apiKey: "AIzaSyDnuqf_vlk9eit4bMUb6rw9ccYPlC01lVQ",
  authDomain: "biteandco-a2591.firebaseapp.com",
  projectId: "biteandco-a2591",
  storageBucket: "biteandco-a2591.appspot.com",
  messagingSenderId: "142048686691",
  appId: "1:142048686691:web:ba57a6565d6a24c0657e56",
});

const messaging = firebase.messaging();

// Handles a push that arrives while no dashboard tab is focused/open.
// Foreground pushes (tab open) are handled by onMessage() in adminPush.js.
messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || 'Bite&Co', {
    body: body || '',
    icon: '/favicon.ico',
    data: payload.data,
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link || '/dashboard';
  event.waitUntil(clients.openWindow(link));
});