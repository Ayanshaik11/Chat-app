import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from "firebase/firestore";

import { db } from "../firebase";
import { chatIdFor, handleFromEmail } from "./utils";

/* ------------------------------------------------------------------ users */

// The Google account UID is the user id everywhere in this app.
export async function ensureProfile(user) {
  const userRef = doc(db, "users", user.uid);
  const snapshot = await getDoc(userRef);

  if (snapshot.exists()) {
    await updateDoc(userRef, { lastSeen: serverTimestamp() });
    return { id: user.uid, ...snapshot.data() };
  }

  const profile = {
    uid: user.uid,
    email: user.email || "",
    emailLower: (user.email || "").toLowerCase(),
    name: user.displayName || (user.email || "New user").split("@")[0],
    username: handleFromEmail(user.email),
    about: "",
    photo: user.photoURL || "",
    friends: [],
    createdAt: serverTimestamp(),
    lastSeen: serverTimestamp()
  };

  await setDoc(userRef, profile);
  return { id: user.uid, ...profile };
}

export function watchProfile(uid, callback) {
  return onSnapshot(doc(db, "users", uid), (snapshot) => {
    callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
  });
}

export async function getProfile(uid) {
  const snapshot = await getDoc(doc(db, "users", uid));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function updateProfile(uid, changes) {
  await updateDoc(doc(db, "users", uid), changes);
}

// Search people by their Gmail address (or name)
export async function searchPeople(text, myUid) {
  const term = text.trim().toLowerCase();
  if (term.length < 2) return [];

  const byEmail = await getDocs(
    query(
      collection(db, "users"),
      orderBy("emailLower"),
      where("emailLower", ">=", term),
      where("emailLower", "<=", term + "\uf8ff"),
      limit(25)
    )
  );

  const found = new Map();
  byEmail.forEach((snapshot) => {
    if (snapshot.id !== myUid) found.set(snapshot.id, { id: snapshot.id, ...snapshot.data() });
  });

  // Also match on name so "ayan" finds someone even without typing the email
  const all = await getDocs(query(collection(db, "users"), limit(200)));
  all.forEach((snapshot) => {
    const data = snapshot.data();
    if (snapshot.id === myUid) return;
    if ((data.name || "").toLowerCase().includes(term)) {
      found.set(snapshot.id, { id: snapshot.id, ...data });
    }
  });

  return Array.from(found.values());
}

export async function suggestedPeople(myUid, myFriends = []) {
  const snapshot = await getDocs(query(collection(db, "users"), orderBy("createdAt", "desc"), limit(40)));
  return snapshot.docs
    .map((entry) => ({ id: entry.id, ...entry.data() }))
    .filter((person) => person.id !== myUid && !myFriends.includes(person.id));
}

/* ----------------------------------------------------------- friendships */

export function requestId(from, to) {
  return `${from}__${to}`;
}

export async function sendFriendRequest(me, them) {
  const id = requestId(me.uid, them.id);

  await setDoc(doc(db, "friendRequests", id), {
    from: me.uid,
    to: them.id,
    fromName: me.name,
    fromPhoto: me.photo || "",
    status: "pending",
    createdAt: serverTimestamp()
  });

  await notify(them.id, {
    type: "request",
    from: me.uid,
    fromName: me.name,
    fromPhoto: me.photo || "",
    text: `${me.name} sent you a friend request`
  });
}

export async function cancelFriendRequest(fromUid, toUid) {
  await deleteDoc(doc(db, "friendRequests", requestId(fromUid, toUid)));
}

export async function acceptFriendRequest(me, request) {
  const batch = writeBatch(db);

  batch.update(doc(db, "users", me.uid), { friends: arrayUnion(request.from) });
  batch.update(doc(db, "users", request.from), { friends: arrayUnion(me.uid) });
  batch.delete(doc(db, "friendRequests", request.id));

  await batch.commit();

  await notify(request.from, {
    type: "accepted",
    from: me.uid,
    fromName: me.name,
    fromPhoto: me.photo || "",
    text: `${me.name} accepted your friend request`
  });
}

export async function declineFriendRequest(request) {
  await deleteDoc(doc(db, "friendRequests", request.id));
}

export async function removeFriend(myUid, otherUid) {
  const batch = writeBatch(db);
  batch.update(doc(db, "users", myUid), { friends: arrayRemove(otherUid) });
  batch.update(doc(db, "users", otherUid), { friends: arrayRemove(myUid) });
  await batch.commit();
}

export function watchIncomingRequests(uid, callback) {
  return onSnapshot(query(collection(db, "friendRequests"), where("to", "==", uid)), (snapshot) => {
    callback(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
  });
}

export function watchOutgoingRequests(uid, callback) {
  return onSnapshot(query(collection(db, "friendRequests"), where("from", "==", uid)), (snapshot) => {
    callback(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
  });
}

/* ---------------------------------------------------------------- posts */

export async function createPost(me, imageUrl, caption) {
  await addDoc(collection(db, "posts"), {
    uid: me.uid,
    authorName: me.name,
    authorPhoto: me.photo || "",
    image: imageUrl,
    caption: caption || "",
    likes: [],
    createdAt: serverTimestamp()
  });
}

export function watchFeed(callback) {
  return onSnapshot(query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(60)), (snapshot) => {
    callback(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
  });
}

export function watchUserPosts(uid, callback) {
  return onSnapshot(query(collection(db, "posts"), where("uid", "==", uid)), (snapshot) => {
    const posts = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
    posts.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    callback(posts);
  });
}

export async function toggleLike(post, me) {
  const liked = (post.likes || []).includes(me.uid);

  await updateDoc(doc(db, "posts", post.id), {
    likes: liked ? arrayRemove(me.uid) : arrayUnion(me.uid)
  });

  if (!liked && post.uid !== me.uid) {
    await notify(post.uid, {
      type: "like",
      from: me.uid,
      fromName: me.name,
      fromPhoto: me.photo || "",
      text: `${me.name} liked your post`
    });
  }
}

export async function deletePost(postId) {
  await deleteDoc(doc(db, "posts", postId));
}

/* -------------------------------------------------------------- stories */

export async function createStory(me, mediaUrl, type) {
  await addDoc(collection(db, "stories"), {
    uid: me.uid,
    authorName: me.name,
    authorPhoto: me.photo || "",
    media: mediaUrl,
    type,
    createdAt: serverTimestamp(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000
  });
}

// Only stories from the last 24 hours ever reach the screen
export function watchStories(callback) {
  const cutoff = Date.now();
  return onSnapshot(query(collection(db, "stories"), where("expiresAt", ">", cutoff), limit(200)), (snapshot) => {
    const stories = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
    stories.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    callback(stories);
  });
}

export async function deleteStory(storyId) {
  await deleteDoc(doc(db, "stories", storyId));
}

/* ----------------------------------------------------------------- chat */

export async function openChat(me, them) {
  const id = chatIdFor(me.uid, them.id);
  const chatRef = doc(db, "chats", id);
  const snapshot = await getDoc(chatRef);

  if (!snapshot.exists()) {
    await setDoc(chatRef, {
      members: [me.uid, them.id],
      names: { [me.uid]: me.name, [them.id]: them.name },
      photos: { [me.uid]: me.photo || "", [them.id]: them.photo || "" },
      lastMessage: "",
      lastSender: "",
      updatedAt: serverTimestamp()
    });
  }

  return id;
}

export function watchChats(uid, callback) {
  return onSnapshot(query(collection(db, "chats"), where("members", "array-contains", uid)), (snapshot) => {
    const chats = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
    chats.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
    callback(chats);
  });
}

export function watchMessages(chatId, callback) {
  return onSnapshot(
    query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"), limit(300)),
    (snapshot) => callback(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })))
  );
}

export async function sendMessage(chatId, me, them, text) {
  const body = text.trim();
  if (!body) return;

  await addDoc(collection(db, "chats", chatId, "messages"), {
    from: me.uid,
    text: body,
    createdAt: serverTimestamp()
  });

  await setDoc(
    doc(db, "chats", chatId),
    {
      members: [me.uid, them.id],
      names: { [me.uid]: me.name, [them.id]: them.name },
      photos: { [me.uid]: me.photo || "", [them.id]: them.photo || "" },
      lastMessage: body,
      lastSender: me.uid,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

/* -------------------------------------------------------- notifications */

export async function notify(toUid, payload) {
  try {
    await addDoc(collection(db, "notifications"), {
      to: toUid,
      read: false,
      createdAt: serverTimestamp(),
      ...payload
    });
  } catch (error) {
    console.warn("Could not write notification", error);
  }
}

export function watchNotifications(uid, callback) {
  return onSnapshot(query(collection(db, "notifications"), where("to", "==", uid), limit(100)), (snapshot) => {
    const items = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
    items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    callback(items);
  });
}

export async function markAllRead(uid) {
  const snapshot = await getDocs(query(collection(db, "notifications"), where("to", "==", uid), where("read", "==", false)));
  if (snapshot.empty) return;

  const batch = writeBatch(db);
  snapshot.forEach((entry) => batch.update(entry.ref, { read: true }));
  await batch.commit();
}

export async function clearNotifications(uid) {
  const snapshot = await getDocs(query(collection(db, "notifications"), where("to", "==", uid)));
  if (snapshot.empty) return;

  const batch = writeBatch(db);
  snapshot.forEach((entry) => batch.delete(entry.ref));
  await batch.commit();
}

// "Logged in" / "logged out" activity shows in the notifications tab
export async function logActivity(me, kind) {
  await notify(me.uid, {
    type: kind,
    from: me.uid,
    fromName: me.name,
    fromPhoto: me.photo || "",
    text: kind === "login" ? "You logged in on this device" : "You logged out"
  });
}
