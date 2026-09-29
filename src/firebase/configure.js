import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set');
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
} catch (error) {
  console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', error);
  throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT_KEY format');
}

const app =
  getApps().length === 0
    ? initializeApp({
        credential: cert(serviceAccount),
        storageBucket: "biteandco-a2591.firebasestorage.app",
      })
    : getApp();

const db = getFirestore(app);
const storage = getStorage(app);

export { db, storage, app };
