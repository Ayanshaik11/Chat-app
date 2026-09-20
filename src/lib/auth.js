import { GoogleAuthProvider, signInWithCredential, signOut } from "firebase/auth";

import { auth } from "../firebase";
import { GOOGLE_WEB_CLIENT_ID } from "../config";

// Loaded only when needed, so a problem with Google login can never stop the app opening
function googleModule() {
  return require("@react-native-google-signin/google-signin");
}

export function configureGoogle() {
  try {
    const { GoogleSignin } = googleModule();
    GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, offlineAccess: false });
  } catch (error) {
    console.warn("Google sign-in is not available", error);
  }
}

// Returns false if the person backed out of the Google account chooser
export async function loginWithGoogle() {
  const { GoogleSignin, isSuccessResponse } = googleModule();

  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) return false;

  const idToken = response.data.idToken;
  if (!idToken) throw new Error("Google did not return a login token.");

  await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
  return true;
}

export async function logout() {
  try {
    await googleModule().GoogleSignin.signOut();
  } catch (error) {
    // not signed in with Google - fine
  }
  await signOut(auth);
}

function statusCodes() {
  try {
    return googleModule().statusCodes || {};
  } catch (error) {
    return {};
  }
}

export function isCancelled(error) {
  const code = String((error && error.code) || "");
  const codes = statusCodes();
  return code === codes.SIGN_IN_CANCELLED || code === codes.IN_PROGRESS;
}

export function errorMessage(error) {
  console.error(error);

  const code = String((error && error.code) || "");
  const message = String((error && error.message) || "");

  if (code === "auth/network-request-failed") return "Network error. Check your connection.";
  if (code === statusCodes().PLAY_SERVICES_NOT_AVAILABLE) {
    return "Google Play Services is missing or out of date on this phone.";
  }
  if (code === "10" || /DEVELOPER_ERROR|\b10\b/.test(message)) {
    return (
      "Google login isn't set up correctly (error 10).\n\n" +
      "The SHA-1 from the GitHub build summary must be added in Firebase " +
      "(Project settings > your Android app, package com.chat.app), and the Web client ID " +
      "in src/config.js must come from the same Firebase project."
    );
  }

  return message || "Something went wrong. Try again.";
}
