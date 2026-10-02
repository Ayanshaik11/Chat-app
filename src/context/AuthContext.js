import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { AppState } from 'react-native';

import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';

import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signOut as fbSignOut,
} from 'firebase/auth';

import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import {
  auth,
  db,
  GOOGLE_WEB_CLIENT_ID,
} from '../config/firebase';

import {
  addNotification,
} from '../services/notifications';


GoogleSignin.configure({
  webClientId: GOOGLE_WEB_CLIENT_ID,
  offlineAccess: false,
});


const AuthContext = createContext(null);


// The Google account id is used as the app's user id
export const googleIdOf = (fbUser) =>
  fbUser
    ?.providerData
    ?.find(
      (p) => p.providerId === 'google.com'
    )
    ?.uid || null;


export function AuthProvider({ children }) {
  const [fbUser, setFbUser] = useState(null);

  const [initializing, setInitializing] =
    useState(true);

  const [profile, setProfile] =
    useState(null);

  const [busy, setBusy] =
    useState(false);

  const googleId =
    googleIdOf(fbUser);


  /*
   * Firebase authentication listener
   */
  useEffect(() => {
    return onAuthStateChanged(
      auth,
      (user) => {
        setFbUser(user);

        if (!user) {
          setProfile(null);
        }

        setInitializing(false);
      }
    );
  }, []);


  /*
   * Load/create the Firestore profile.
   *
   * Google account information is used
   * ONLY when the Firestore profile does
   * not exist.
   *
   * Existing King X profile information
   * is never replaced by Google data.
   */
  useEffect(() => {
    if (!fbUser || !googleId) {
      return undefined;
    }

    let cancelled = false;
    let unsubscribe = null;

    const ref = doc(
      db,
      'users',
      googleId
    );


    const fallback = {
      id: googleId,

      name:
        fbUser.displayName ||
        'User',

      email:
        fbUser.email ||
        '',

      photoURL:
        fbUser.photoURL ||
        '',

      username:
        (fbUser.email || 'user')
          .split('@')[0],

      about: '',
    };


    const initProfile = async () => {
      try {
        const snap =
          await getDoc(ref);


        /*
         * NEW ACCOUNT
         *
         * Google information is used
         * only during first creation.
         */
        if (!snap.exists()) {
          const email =
            fbUser.email || '';

          await setDoc(ref, {
            id: googleId,

            uid: fbUser.uid,

            name:
              fbUser.displayName ||
              email.split('@')[0] ||
              'User',

            username:
              email.split('@')[0] ||
              googleId,

            email,

            emailLower:
              email.toLowerCase(),

            photoURL:
              fbUser.photoURL ||
              '',

            about:
              'Hey there! I am using Chat App.',

            /*
             * Activity Status default
             * for a brand-new account.
             */
            showOnline: true,

            online: true,

            lastSeen:
              serverTimestamp(),

            createdAt:
              serverTimestamp(),
          });
        }

      } catch (e) {
        console.warn(
          'profile init failed',
          e
        );

        if (!cancelled) {
          setProfile(fallback);
        }

        return;
      }


      if (cancelled) {
        return;
      }


      /*
       * Realtime Firestore profile listener.
       *
       * This keeps:
       *
       * photoURL
       * about
       * username
       * name
       * showOnline
       *
       * synchronized with Firestore.
       */
      unsubscribe = onSnapshot(
        ref,

        (snap) => {
          if (!snap.exists()) {
            return;
          }

          setProfile({
            id: snap.id,
            ...snap.data(),
          });
        },

        (error) => {
          console.warn(
            'profile listener failed',
            error
          );
        }
      );
    };


    initProfile();


    return () => {
      cancelled = true;

      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [
    fbUser?.uid,
    googleId,
  ]);


  /*
   * Change Activity Status.
   *
   * This is stored in Firestore instead
   * of only AsyncStorage.
   *
   * Therefore it survives logout/login.
   */
  const setActivityStatus =
    useCallback(
      async (enabled) => {
        if (!googleId) {
          return;
        }

        await updateDoc(
          doc(db, 'users', googleId),
          {
            showOnline: enabled,

            online:
              enabled &&
              AppState.currentState ===
                'active',

            lastSeen:
              serverTimestamp(),
          }
        );
      },
      [googleId]
    );


  /*
   * Online / last seen.
   *
   * Activity Status is controlled by
   * profile.showOnline from Firestore.
   */
  useEffect(() => {
    if (!googleId) {
      return undefined;
    }


    const ping = () => {
      const activityEnabled =
        profile?.showOnline !== false;


      updateDoc(
        doc(db, 'users', googleId),
        {
          online:
            AppState.currentState ===
              'active' &&
            activityEnabled,

          lastSeen:
            serverTimestamp(),
        }
      ).catch(() => {});
    };


    /*
     * Detect foreground/background.
     */
    const sub =
      AppState.addEventListener(
        'change',
        ping
      );


    /*
     * Update immediately.
     */
    ping();


    /*
     * Heartbeat every 25 seconds.
     */
    const heartbeat =
      setInterval(() => {
        if (
          AppState.currentState ===
          'active'
        ) {
          ping();
        }
      }, 25000);


    return () => {
      sub.remove();
      clearInterval(heartbeat);
    };
  }, [
    googleId,
    profile?.showOnline,
  ]);


  /*
   * Google Sign In
   */
  const signInWithGoogle =
    useCallback(async () => {
      setBusy(true);

      try {
        await GoogleSignin.hasPlayServices({
          showPlayServicesUpdateDialog: true,
        });


        const res =
          await GoogleSignin.signIn();


        if (
          res?.type ===
          'cancelled'
        ) {
          return;
        }


        /*
         * Supports both old and new
         * Google Sign-In response formats.
         */
        const data =
          res?.data ?? res;


        if (!data?.idToken) {
          throw new Error(
            'Google did not return an ID token. Check GOOGLE_WEB_CLIENT_ID.'
          );
        }


        const credential =
          GoogleAuthProvider.credential(
            data.idToken
          );


        const result =
          await signInWithCredential(
            auth,
            credential
          );


        const gid =
          googleIdOf(result.user);


        if (gid) {
          addNotification(
            gid,
            {
              type: 'login',
              text:
                'You logged in to your account',
            }
          ).catch(() => {});
        }

      } catch (e) {
        if (
          e?.code ===
            statusCodes.SIGN_IN_CANCELLED ||
          e?.code ===
            statusCodes.IN_PROGRESS
        ) {
          return;
        }

        throw e;

      } finally {
        setBusy(false);
      }
    }, []);


  /*
   * Logout
   */
  const logout =
    useCallback(async () => {
      try {
        if (googleId) {
          await addNotification(
            googleId,
            {
              type: 'logout',
              text:
                'You logged out of your account',
            }
          );


          /*
           * Do NOT change showOnline.
           *
           * The user's Activity Status
           * preference must survive logout.
           */
          await updateDoc(
            doc(db, 'users', googleId),
            {
              online: false,

              lastSeen:
                serverTimestamp(),
            }
          );
        }
      } catch {}


      /*
       * Sign out from Google.
       */
      try {
        await GoogleSignin.signOut();
      } catch {}


      /*
       * Sign out from Firebase.
       */
      await fbSignOut(auth);
    }, [googleId]);


  const value = useMemo(
    () => ({
      fbUser,

      me: profile,

      googleId,

      initializing,

      busy,

      signInWithGoogle,

      logout,

      setActivityStatus,
    }),
    [
      fbUser,
      profile,
      googleId,
      initializing,
      busy,
      signInWithGoogle,
      logout,
      setActivityStatus,
    ]
  );


  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}


export const useAuth = () =>
  useContext(AuthContext);