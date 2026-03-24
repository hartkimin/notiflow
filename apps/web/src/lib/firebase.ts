import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported, type Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function getFirebaseApp(): FirebaseApp {
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
}

export async function getMessagingInstance(): Promise<Messaging | null> {
  if (typeof window === 'undefined') return null;
  const supported = await isSupported();
  if (!supported) return null;
  return getMessaging(getFirebaseApp());
}

export async function getFCMToken(): Promise<string | null> {
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    console.warn('NEXT_PUBLIC_FIREBASE_VAPID_KEY not set');
    return null;
  }

  const messaging = await getMessagingInstance();
  if (!messaging) return null;

  // Register the Firebase messaging service worker with config
  const configParam = encodeURIComponent(JSON.stringify(firebaseConfig));
  const swRegistration = await navigator.serviceWorker.register(
    `/firebase-messaging-sw.js?config=${configParam}`,
    { scope: '/' }
  );

  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: swRegistration,
  });

  return token || null;
}

export { onMessage };
