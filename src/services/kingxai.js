import AsyncStorage from '@react-native-async-storage/async-storage';
import { KING_X_AI_URL } from '../config/kingxai';

/*
 King X AI client.
 - Every request carries the signed-in user's Firebase ID token, the backend keeps each user's chat private.
 - A copy of the last messages is kept on the phone, so the chat opens instantly (even offline).
*/

const CONVERSATION = 'main';
const CACHE_LIMIT = 60;
const TIMEOUT_MS = 75000; // the backend gives up after ~50s, so this is only a safety net
const cacheKey = (uid) => `kingxai.history.v1.${uid}`;

async function call(fbUser, { method = 'GET', query = '', body } = {}, retry = true) {
  if (!fbUser || typeof fbUser.getIdToken !== 'function') {
    throw Object.assign(new Error('Please sign in again.'), { status: 401 });
  }

  const token = await fbUser.getIdToken(!retry);
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = setTimeout(() => controller?.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${KING_X_AI_URL}/api/chat${query}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      ...(controller ? { signal: controller.signal } : {}),
    });

    let data = {};
    try { data = await response.json(); } catch {}

    if (response.status === 401 && retry) return call(fbUser, { method, query, body }, false);

    if (!response.ok) {
      throw Object.assign(new Error(data?.error || `Request failed (${response.status})`), { status: response.status, usage: data?.usage || null });
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export async function askKingXAI(fbUser, message, userName) {
  const data = await call(fbUser, {
    method: 'POST',
    body: { message, conversationId: CONVERSATION, userName: userName || '' },
  });
  if (!data?.reply) throw new Error('King X AI sent an empty answer.');
  return { reply: data.reply, usage: data.usage || null };
}

export async function fetchHistory(fbUser) {
  const data = await call(fbUser, { query: `?conversationId=${CONVERSATION}&limit=60` });
  const list = (Array.isArray(data?.messages) ? data.messages : []).map((m) => ({
    id: `h_${m.id}`,
    role: m.role,
    text: m.text,
  }));
  return { list, usage: data?.usage || null };
}

export async function clearHistory(fbUser) {
  await call(fbUser, { method: 'DELETE', query: `?conversationId=${CONVERSATION}` });
}

export async function loadCachedHistory(uid) {
  try {
    const list = JSON.parse((await AsyncStorage.getItem(cacheKey(uid))) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveCachedHistory(uid, items) {
  const keep = items
    .filter((m) => m && !m.local && !m.error && m.text && (m.role === 'user' || m.role === 'model'))
    .slice(-CACHE_LIMIT)
    .map((m) => ({ id: m.id, role: m.role, text: m.text }));
  return AsyncStorage.setItem(cacheKey(uid), JSON.stringify(keep)).catch(() => {});
}

export const clearCachedHistory = (uid) => AsyncStorage.removeItem(cacheKey(uid)).catch(() => {});

export function friendlyError(error) {
  const message = String(error?.message || '');
  if (error?.name === 'AbortError' || /abort|timed? ?out/i.test(message)) {
    return 'King X AI is taking too long to answer. Please try again.';
  }
  if (/network request failed|failed to fetch/i.test(message)) {
    return 'I couldn\'t reach King X AI. Check your internet and try again.';
  }
  if (error?.status === 503 || error?.status === 504) return 'King X AI is very busy right now. Please try again in a few seconds.';
  if (error?.status === 401) return 'Your session expired. Please sign in again.';
  if (error?.status === 429) return error.message || 'King X AI is busy. Try again in a moment.';
  return message || 'Something went wrong. Please try again.';
}
