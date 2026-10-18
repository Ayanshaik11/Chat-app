import { fetchWallpaperUrls } from './wallpapersApi';

/*
 * Shared, in-memory cache of signed wallpaper URLs (never persisted).
 *
 * Signed URLs expire, so they are held only for the current app session and
 * refreshed a little before they lapse. The whole registry is fetched once and
 * keyed by wallpaper id, so every component (chat background, picker, preview)
 * reads from the same map without extra network calls.
 *
 * - the store independently tracks the *authorized* Firebase uid (null when
 *   signed out); ensureWallpaperUrls refuses any other uid, so a stale user
 *   object cannot start a fetch or reactivate a previous/signed-out session
 * - concurrent callers for the same user share one in-flight request
 * - a refresh is scheduled for (expiry - SAFETY_MARGIN); a pending timer belongs
 *   to the user that scheduled it and cannot repopulate a later user's cache
 * - a failed refresh keeps the last-known URLs and never retries in a loop
 */

const SAFETY_MARGIN_MS = 5 * 60 * 1000; // refresh 5 minutes before expiry
const MIN_RETRY_GAP_MS = 15 * 1000; // don't re-attempt a failed fetch too fast
const MIN_REFRESH_DELAY_MS = 30 * 1000;
const FALLBACK_TTL_MS = 60 * 60 * 1000; // used when expiresIn is missing/zero/invalid

const EMPTY = Object.freeze({});

let state = { urls: EMPTY, expiresAt: 0, status: 'idle', error: null };
let inFlight = null; // { uid, seq, promise } | null
let lastUser = null;
let authorizedUid = null; // the only uid allowed to fetch; null = signed out / not restored
let lastAttemptAt = 0;
let requestSeq = 0;
let refreshTimer = null;
const listeners = new Set();

function emit() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* a broken listener must not break the others */
    }
  });
}

function setState(next) {
  state = next;
  emit();
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot() {
  return state;
}

function clearTimer() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

function nextSeq() {
  requestSeq += 1;
  return requestSeq;
}

// Drop everything tied to the current user (cache, timer, in-flight). Bumping
// requestSeq makes any request already running report its result as stale.
function clearCache() {
  requestSeq += 1;
  clearTimer();
  inFlight = null;
  setState({ urls: EMPTY, expiresAt: 0, status: 'idle', error: null });
}

/**
 * Record which Firebase user is currently authorized (null when signed out).
 * This must be driven by the real auth-state lifecycle. Changing the authorized
 * user invalidates any cache, timer or in-flight request from the old one, so a
 * stale user object can never be reactivated.
 */
export function setAuthorizedUser(fbUser) {
  const uid = fbUser?.uid || null;
  if (uid === authorizedUid) return; // token refresh / same session: keep the cache
  authorizedUid = uid;
  lastUser = uid ? fbUser : null;
  clearCache();
}

function scheduleRefresh(user, delayMs) {
  clearTimer();
  const uid = user?.uid || null;
  if (!user || !Number.isFinite(delayMs)) return;
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    if (uid !== authorizedUid) return; // timer belongs to a previous account
    ensureWallpaperUrls(user, { force: true }).catch(() => {});
  }, Math.max(delayMs, MIN_REFRESH_DELAY_MS));
  // React Native returns a numeric timer id; Node's timer object has unref().
  if (refreshTimer && typeof refreshTimer.unref === 'function') refreshTimer.unref();
}

// A conservative fallback for a missing/zero/invalid expiresIn keeps isFresh()
// meaningful and avoids a rapid refetch/poll cycle.
function expiryFrom(result) {
  const seconds = Number(result?.expiresIn);
  const ttl = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : FALLBACK_TTL_MS;
  return Date.now() + ttl;
}

export function isFresh() {
  return state.status === 'ready' && Date.now() < state.expiresAt - SAFETY_MARGIN_MS;
}

/**
 * Make sure the cache holds fresh signed URLs. Safe to call from effects (never
 * from render): it is a no-op while fresh and shares any in-flight request.
 */
export async function ensureWallpaperUrls(fbUser, options = {}) {
  const force = options.force === true;

  if (!fbUser || typeof fbUser.getIdToken !== 'function') return state;
  const uid = fbUser.uid || null;

  // Only the currently authorized user may fetch. A stale user object (from
  // before sign-out or an account switch) is refused here, and nothing is
  // fetched before auth restoration has reported a uid.
  if (uid === null || uid !== authorizedUid) return state;

  lastUser = fbUser;

  if (!force && isFresh()) return state;

  // Bound retries: skip a non-forced attempt that follows a recent failure.
  if (!force && state.status === 'error' && Date.now() - lastAttemptAt < MIN_RETRY_GAP_MS) {
    return state;
  }

  if (inFlight && inFlight.uid === uid) return inFlight.promise; // same-user dedupe

  lastAttemptAt = Date.now();
  const previous = state;
  const seq = nextSeq();
  setState({ ...state, status: 'loading', error: null });

  const promise = (async () => {
    try {
      const result = await fetchWallpaperUrls(fbUser);
      // Ignore a result that arrived after sign-out or an account change.
      if (seq !== requestSeq || uid !== authorizedUid) return state;

      const expiresAt = expiryFrom(result);
      setState({ urls: result.urls || EMPTY, expiresAt, status: 'ready', error: null });
      scheduleRefresh(fbUser, expiresAt - Date.now() - SAFETY_MARGIN_MS);
      return state;
    } catch (error) {
      if (seq !== requestSeq || uid !== authorizedUid) return state; // stale
      // Keep the last-known URLs so a transient failure doesn't blank the chat.
      const hadUrls = Object.keys(previous.urls || {}).length > 0;
      setState({
        urls: previous.urls || EMPTY,
        expiresAt: previous.expiresAt || 0,
        status: hadUrls ? 'ready' : 'error',
        error,
      });
      clearTimer();
      return state;
    } finally {
      if (inFlight && inFlight.seq === seq) inFlight = null;
    }
  })();

  inFlight = { uid, seq, promise };
  return promise;
}

/** Last-known signed URL for an id, or null. Synchronous — safe during render. */
export function peekWallpaperUrl(id) {
  return (id && state.urls[id]) || null;
}

export function currentWallpaperStatus() {
  return state.status;
}

/** Clear the cache and become signed-out (e.g. explicit sign-out). */
export function resetWallpaperUrls() {
  authorizedUid = null;
  lastUser = null;
  clearCache();
}
