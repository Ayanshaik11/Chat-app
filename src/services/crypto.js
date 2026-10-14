/**
 * End-to-end encryption for King X text messages.
 *
 *  - Every user has an X25519 key pair (tweetnacl "box").
 *  - The PRIVATE key never leaves the phone (stored in the Android Keystore
 *    through expo-secure-store). The PUBLIC key is published on users/{id}.publicKey.
 *  - A message is encrypted with a key shared by the two users (X25519 + XSalsa20-Poly1305).
 *    Firestore, Vercel and FCM only ever see ciphertext.
 */
import nacl from 'tweetnacl';
import * as SecureStore from 'expo-secure-store';
import * as ExpoCrypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../config/firebase';

// React Native has no built-in secure random source - use expo-crypto's
nacl.setPRNG((x, n) => {
  const bytes = ExpoCrypto.getRandomBytes(n);
  for (let i = 0; i < n; i += 1) x[i] = bytes[i];
});

/* ---------------- base64 / utf8 (no Buffer / TextDecoder in Hermes) ---------------- */

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP = (() => {
  const t = new Uint8Array(128).fill(255);
  for (let i = 0; i < 64; i += 1) t[B64.charCodeAt(i)] = i;
  return t;
})();

export function toB64(u8) {
  let out = '';
  for (let i = 0; i < u8.length; i += 3) {
    const a = u8[i];
    const b = i + 1 < u8.length ? u8[i + 1] : 0;
    const c = i + 2 < u8.length ? u8[i + 2] : 0;
    out += B64[a >> 2] + B64[((a & 3) << 4) | (b >> 4)];
    out += i + 1 < u8.length ? B64[((b & 15) << 2) | (c >> 6)] : '=';
    out += i + 2 < u8.length ? B64[c & 63] : '=';
  }
  return out;
}

export function fromB64(str) {
  const s = String(str || '').replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((s.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < s.length; i += 4) {
    const a = B64_LOOKUP[s.charCodeAt(i)];
    const b = B64_LOOKUP[s.charCodeAt(i + 1)];
    const c = i + 2 < s.length ? B64_LOOKUP[s.charCodeAt(i + 2)] : 0;
    const d = i + 3 < s.length ? B64_LOOKUP[s.charCodeAt(i + 3)] : 0;
    out[o++] = (a << 2) | (b >> 4);
    if (i + 2 < s.length) out[o++] = ((b & 15) << 4) | (c >> 2);
    if (i + 3 < s.length) out[o++] = ((c & 3) << 6) | d;
  }
  return out;
}

export function utf8Encode(str) {
  const out = [];
  for (const ch of String(str)) {
    const cp = ch.codePointAt(0);
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
  }
  return Uint8Array.from(out);
}

export function utf8Decode(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i++];
    let cp;
    if (b < 0x80) cp = b;
    else if (b < 0xe0) cp = ((b & 31) << 6) | (bytes[i++] & 63);
    else if (b < 0xf0) cp = ((b & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
    else cp = ((b & 7) << 18) | ((bytes[i++] & 63) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
    out += String.fromCodePoint(cp);
  }
  return out;
}

/* ---------------- key management ---------------- */

let myId = null;
let mySecret = null; // Uint8Array
let myPublic = null; // base64
let ready = false;
const listeners = new Set();
const sharedCache = new Map(); // their public key (b64) -> shared key
const peerKeys = new Map(); // userId -> public key (b64)

const notify = () => listeners.forEach((l) => l());

/** true once this phone's key pair is loaded and decrypting is possible */
export function useE2EReady() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => listeners.delete(l);
  }, []);
  return ready;
}

export function isE2EReady() {
  return ready;
}

export async function initCrypto(userId) {
  if (!userId) return;
  if (ready && myId === userId) return;

  myId = userId;
  ready = false;
  mySecret = null;
  sharedCache.clear();

  const storeKey = `kx_sk_v1_${userId}`;
  let secretB64 = null;
  try {
    secretB64 = await SecureStore.getItemAsync(storeKey);
  } catch (e) {
    console.warn('KING X: secure store read failed', e?.message || e);
  }

  let kp;
  if (secretB64) {
    kp = nacl.box.keyPair.fromSecretKey(fromB64(secretB64));
  } else {
    kp = nacl.box.keyPair();
    await SecureStore.setItemAsync(storeKey, toB64(kp.secretKey));
  }

  mySecret = kp.secretKey;
  myPublic = toB64(kp.publicKey);
  ready = true;
  notify();

  // publish the public key (only when it changed)
  try {
    const flagKey = `kx_pub_published_${userId}`;
    const published = await AsyncStorage.getItem(flagKey);
    if (published !== myPublic) {
      await setDoc(
        doc(db, 'users', userId),
        { publicKey: myPublic, publicKeyUpdatedAt: serverTimestamp() },
        { merge: true }
      );
      await AsyncStorage.setItem(flagKey, myPublic);
    }
  } catch (e) {
    console.warn('KING X: could not publish public key', e?.message || e);
  }
}

export function setPeerKey(userId, publicKey) {
  if (userId && publicKey) peerKeys.set(userId, publicKey);
}

export async function getPeerKey(userId) {
  if (peerKeys.has(userId)) return peerKeys.get(userId);
  const snap = await getDoc(doc(db, 'users', userId));
  const key = snap.exists() ? snap.data().publicKey : null;
  if (key) peerKeys.set(userId, key);
  return key || null;
}

export function forgetPeerKey(userId) {
  peerKeys.delete(userId);
}

function sharedKey(theirPublicB64) {
  let k = sharedCache.get(theirPublicB64);
  if (!k) {
    k = nacl.box.before(fromB64(theirPublicB64), mySecret);
    sharedCache.set(theirPublicB64, k);
  }
  return k;
}

/* ---------------- encrypt / decrypt ---------------- */

export class NoKeyError extends Error {
  constructor() {
    super('E2E_NO_KEY');
    this.code = 'E2E_NO_KEY';
  }
}

/** Encrypts text for `otherId`. Throws NoKeyError if they have not published a key yet. */
export async function encryptFor(otherId, plain) {
  if (!ready) throw new Error('Encryption is still starting. Try again in a moment.');
  const theirPub = await getPeerKey(otherId);
  if (!theirPub) throw new NoKeyError();

  const nonce = nacl.randomBytes(24);
  const box = nacl.secretbox(utf8Encode(plain), nonce, sharedKey(theirPub));
  return { v: 1, n: toB64(nonce), c: toB64(box), spk: myPublic, rpk: theirPub };
}

/** Returns the plain text, or null when it cannot be decrypted. */
export function decryptFrom(enc, senderId) {
  try {
    if (!ready || !enc || !enc.c || !enc.n) return null;
    const fromMe = senderId === myId;
    const theirPub = fromMe ? enc.rpk : enc.spk;
    const mine = fromMe ? enc.spk : enc.rpk;
    if (!theirPub || mine !== myPublic) return null; // encrypted for an old/other key
    const opened = nacl.secretbox.open(fromB64(enc.c), fromB64(enc.n), sharedKey(theirPub));
    return opened ? utf8Decode(opened) : null;
  } catch {
    return null;
  }
}

export const CANT_DECRYPT = '🔒 Message can’t be decrypted on this device';
