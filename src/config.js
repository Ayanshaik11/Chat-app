// =====================================================================
//  PASTE YOUR FIREBASE DETAILS HERE
//  The GitHub build fails on purpose while "YOUR_" is still in this file.
//  Firebase console -> Project settings -> Your apps -> Web app -> Config
// =====================================================================

export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Firebase console -> Authentication -> Sign-in method -> Google
//   -> "Web SDK configuration" -> Web client ID  (ends with .apps.googleusercontent.com)
export const GOOGLE_WEB_CLIENT_ID = "YOUR_WEB_CLIENT_ID.apps.googleusercontent.com";
