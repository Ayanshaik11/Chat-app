# Chat App (com.chat.app)

Instagram-inspired chat app built with **React Native (Expo) + Firebase**.
Green–blue theme, Poppins + Pacifico fonts, light/dark mode.

## Features
- **Google login** – your Google account ID is the user ID (`users/{googleId}`)
- **Home** – stories (photo/video, disappear after 24 h) + feed of posts (likes, delete)
- **Find** – search people by Gmail, send / cancel / accept friend requests
- **Messages** – friends list with last message, unread badges, online status, real-time chat
- **Notifications** – friend requests (accept/decline), accepted, logged in / logged out
- **Profile** – edit name, username, about, photo; add photo posts (no videos); post grid
- **Settings** – light/dark/system theme, vibration on/off, online status, edit profile, logout

## 1. Install
```bash
npm install
npx expo install --fix     # aligns package versions with the Expo SDK
```

## 2. Add your Firebase config
Open `src/config/firebase.js` and paste:
- `firebaseConfig` (Project settings → Your apps → Web app)
- `GOOGLE_WEB_CLIENT_ID` (Authentication → Sign-in method → Google → Web SDK configuration)

In the Firebase console enable:
1. **Authentication → Google**
2. **Firestore Database**
3. **Storage**
4. Paste `firestore.rules` and `storage.rules` into the Rules tabs (or `firebase deploy --only firestore:rules,storage`)

## 3. Google sign-in on Android
Add an **Android app** in Firebase with package name `com.chat.app` and your **SHA-1**:
```bash
npx expo prebuild
cd android && ./gradlew signingReport      # copy the SHA-1 of "debug"
```
(For EAS builds: `eas credentials` shows the SHA-1.)
For iOS put the reversed iOS client id in `app.json` → `iosUrlScheme`.

## 4. Run (dev build – Expo Go is NOT enough for Google Sign-In)
```bash
npx expo run:android
# or build an APK in the cloud
npx eas build -p android --profile preview
```

## 24-hour stories
Stories older than 24 h are hidden in the app and deleted by their owner's app.
For automatic server-side deletion also add a **TTL policy**:
Firestore → Indexes → TTL → collection `stories`, field `expiresAt`.
(Story files in Storage are removed by the app when the owner deletes/cleans up the story.)

## Data model
```
users/{googleId}                  profile (name, username, email, emailLower, photoURL, about, online, lastSeen)
users/{googleId}/notifications/*  request | accepted | login | logout
requests/{fromId_toId}            pending friend requests
friendships/{idA_idB}             accepted friends (members: [idA, idB])
chats/{idA_idB}                   lastMessage, unread counters
chats/{idA_idB}/messages/*        messages
posts/*                           imageURL, caption, likes[], authorId
stories/*                         mediaURL, mediaType, expiresAt, authorId
```

## Folder structure
```
App.js                 entry, fonts, providers
src/config             firebase config
src/context            Settings (theme, vibration), Auth (Google), AppData (live friends/chats)
src/services           Firestore + Storage helpers
src/screens            all screens
src/components         Avatar, Btn, PostCard, ...
src/navigation         tabs + stack
```

## Notes
- New Firebase projects need the **Blaze (pay-as-you-go) plan** to use Cloud Storage.
- Push notifications when the app is closed need Firebase Cloud Messaging + a server; not included.
  In-app alerts and vibration work while the app is open.
