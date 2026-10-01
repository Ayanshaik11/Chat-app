import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
   * Create / load profile.
   *
   * IMPORTANT:
   *
   * Google photo/bio/default data is used
   * ONLY when the Firestore profile does
   * not exist.
   *
   * Existing King X profile data is never
   * replaced by Google data.
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
         * New user.
         *
         * Google information is used
         * only here.
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
             * Activity Status defaults to ON
             * only for a brand-new account.
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
       * Listen to the Firestore profile.
       *
       * This means changes to:
       *
       * photoURL
       * about
       * username
       * showOnline
       *
       * arrive immediately.
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
   * Activity Status
   *
   * This is saved to Firestore.
   *
   * Therefore it survives:
   *
   * logout
   * login
   * app restart
   * device restart
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
   * Reads showOnline from the Firestore
   * profile instead of local settings.
   */
  useEffect(() => {
    if (!googleId) {
      return undefined;
    }


    const ping = () => {
      const enabled =
        profile?.showOnline !== false;


      updateDoc(
        doc(db, 'users', googleId),
        {
          online:
            AppState.currentState ===
              'active' && enabled,

          lastSeen:
            serverTimestamp(),
        }
      ).catch(() => {});
    };


    /*
     * App foreground/background
     */
    const sub =
      AppState.addEventListener(
        'change',
        ping
      );


    /*
     * Initial status
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
   * Google Login
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


        const result =
          await signInWithCredential(
            auth,
            GoogleAuthProvider.credential(
              data.idToken
            )
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


      try {
        await GoogleSignin.signOut();
      } catch {}


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