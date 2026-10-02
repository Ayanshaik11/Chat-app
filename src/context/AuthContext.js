import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import {
  GoogleAuthProvider, onAuthStateChanged, signInWithCredential, signOut as fbSignOut,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, GOOGLE_WEB_CLIENT_ID } from '../config/firebase';
import { addNotification } from '../services/notifications';
import { useSettings } from './SettingsContext';

GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, offlineAccess: false });

const AuthContext = createContext(null);

// The Google account id is used as the app's user id
export const googleIdOf = (fbUser) =>
  fbUser?.providerData?.find((p) => p.providerId === 'google.com')?.uid || null;

export function AuthProvider({ children }) {
  const { settings } = useSettings();
  const [fbUser, setFbUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [profile, setProfile] = useState(null);
  const [busy, setBusy] = useState(false);
  const googleId = googleIdOf(fbUser);
  const showOnlineRef = useRef(settings.showOnline);
  showOnlineRef.current = settings.showOnline;

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setFbUser(u);
        if (!u) setProfile(null);
        setInitializing(false);
      }),
    []
  );

  // create / load my profile document: users/{googleId}
  useEffect(() => {
    if (!fbUser || !googleId) return undefined;
    let cancelled = false;
    let unsub = null;
    const ref = doc(db, 'users', googleId);
    const fallback = {
      id: googleId,
      name: fbUser.displayName || 'User',
      email: fbUser.email || '',
      photoURL: fbUser.photoURL || '',
      username: (fbUser.email || 'user').split('@')[0],
      about: '',
    };
    (async () => {
      try {
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          const email = fbUser.email || '';
          await setDoc(ref, {
            id: googleId,
            uid: fbUser.uid,
            name: fbUser.displayName || email.split('@')[0] || 'User',
            username: email.split('@')[0] || googleId,
            email,
            emailLower: email.toLowerCase(),
            photoURL: fbUser.photoURL || '',
            about: 'Hey there! I am using Chat App.',
            online: showOnlineRef.current,
            lastSeen: serverTimestamp(),
            createdAt: serverTimestamp(),
          });
        } else {
          await updateDoc(ref, { online: showOnlineRef.current, lastSeen: serverTimestamp() });
        }
      } catch (e) {
        console.warn('profile init failed', e);
        if (!cancelled) setProfile(fallback);
        return;
      }
      if (cancelled) return;
      unsub = onSnapshot(
        ref,
        (s) => s.exists() && setProfile({ id: s.id, ...s.data() }),
        () => {}
      );
    })();
    return () => {
      cancelled = true;
      unsub && unsub();
    };
  }, [fbUser?.uid, googleId]);

  // online / last seen — updates on foreground/background, and a heartbeat
  // every 25s while active so "Online" never gets stuck after the app closes
  useEffect(() => {
    if (!googleId) return undefined;
    const ping = () =>
      updateDoc(doc(db, 'users', googleId), {
        online: AppState.currentState === 'active' && showOnlineRef.current,
        lastSeen: serverTimestamp(),
      }).catch(() => {});
    const sub = AppState.addEventListener('change', ping);
    ping();
    const heartbeat = setInterval(() => {
      if (AppState.currentState === 'active') ping();
    }, 25000);
    return () => {
      sub.remove();
      clearInterval(heartbeat);
    };
  }, [googleId]);

  const signInWithGoogle = useCallback(async () => {
    setBusy(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const res = await GoogleSignin.signIn();
      if (res?.type === 'cancelled') return;
      const data = res?.data ?? res; // works with old and new library versions
      if (!data?.idToken) throw new Error('Google did not return an ID token. Check GOOGLE_WEB_CLIENT_ID.');
      const result = await signInWithCredential(auth, GoogleAuthProvider.credential(data.idToken));
      const gid = googleIdOf(result.user);
      if (gid) {
        addNotification(gid, { type: 'login', text: 'You logged in to your account' }).catch(() => {});
      }
    } catch (e) {
      if (e?.code === statusCodes.SIGN_IN_CANCELLED || e?.code === statusCodes.IN_PROGRESS) return;
      throw e;
    } finally {
      setBusy(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      if (googleId) {
        await addNotification(googleId, { type: 'logout', text: 'You logged out of your account' });
        await updateDoc(doc(db, 'users', googleId), { online: false, lastSeen: serverTimestamp() });
      }
    } catch {}
    try {
      await GoogleSignin.signOut();
    } catch {}
    await fbSignOut(auth);
  }, [googleId]);

  const value = useMemo(
    () => ({ fbUser, me: profile, googleId, initializing, busy, signInWithGoogle, logout }),
    [fbUser, profile, googleId, initializing, busy, signInWithGoogle, logout]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
