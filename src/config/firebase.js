import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

/* ---------------------------------------------------------------
   👉 PASTE YOUR FIREBASE CONFIG HERE
   Firebase console → Project settings → Your apps → Web app → Config
---------------------------------------------------------------- */
export const firebaseConfig = {
  apiKey:
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY ||
    'AIzaSyBS2_Bc-pEhZlkOTCEfrNci9ALNfZDcRR8',
  authDomain:
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    'chat-app-652fc.firebaseapp.com',
  databaseURL:
    process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL ||
    'https://chat-app-652fc-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId:
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'chat-app-652fc',
  storageBucket:
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    'chat-app-652fc.firebasestorage.app',
  messagingSenderId:
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '736943642281',
  appId:
    process.env.EXPO_PUBLIC_FIREBASE_APP_ID ||
    '1:736943642281:web:28e557cd9662c583c87bb8',
  measurementId:
    process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || 'G-6YTN576J6K',
};

export const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  '736943642281-mhi8pbrqjl4vbm8m3u24boavefemp691.apps.googleusercontent.com';

if (!firebaseConfig.apiKey && typeof __DEV__ !== 'undefined' && __DEV__) {
  console.warn(
    '[Firebase Config] EXPO_PUBLIC_FIREBASE_API_KEY is not defined. Ensure your .env file or environment variables are configured.'
  );
}

const firstInit = getApps().length === 0;
const app = firstInit ? initializeApp(firebaseConfig) : getApp();

export const auth = firstInit
  ? initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
  : getAuth(app);

export const db = firstInit
  ? initializeFirestore(app, { experimentalAutoDetectLongPolling: true })
  : getFirestore(app);

export const storage = getStorage(app);
