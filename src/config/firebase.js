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
  apiKey: "AIzaSyBS2_Bc-pEhZlkOTCEfrNci9ALNfZDcRR8",
  authDomain: "chat-app-652fc.firebaseapp.com",
  databaseURL: "https://chat-app-652fc-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "chat-app-652fc",
  storageBucket: "chat-app-652fc.firebasestorage.app",
  messagingSenderId: "736943642281",
  appId: "1:736943642281:web:28e557cd9662c583c87bb8",
  measurementId: "G-6YTN576J6K"
};
/* 👉 Firebase console → Authentication → Sign-in method → Google →
   "Web SDK configuration" → Web client ID */
export const GOOGLE_WEB_CLIENT_ID = '736943642281-mhi8pbrqjl4vbm8m3u24boavefemp691.apps.googleusercontent.com';

const firstInit = getApps().length === 0;
const app = firstInit ? initializeApp(firebaseConfig) : getApp();

export const auth = firstInit
  ? initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
  : getAuth(app);

export const db = firstInit
  ? initializeFirestore(app, { experimentalAutoDetectLongPolling: true })
  : getFirestore(app);

export const storage = getStorage(app);
