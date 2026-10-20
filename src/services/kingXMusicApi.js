import { auth } from '../config/firebase';

const API_BASE_URL = 'https://music-api-etqi.onrender.com';
const DEFAULT_TIMEOUT_MS = 20000;

export function getMusicApiBaseUrl() {
  return API_BASE_URL;
}

export function getMusicApiBaseUrls() {
  return [API_BASE_URL];
}

export function isAbortError(error) {
  return (
    error?.name === 'AbortError' ||
    error?.code === 'ABORT_ERR' ||
    error?.name === 'AbortErrorException'
  );
}

export function toErrorMessage(value, fallback = 'Something went wrong.') {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value instanceof Error && value.message) return value.message;

  if (value && typeof value === 'object') {
    const message = value.message ?? value.error ?? value.reason;
    if (typeof message === 'string' && message.trim()) return message.trim();
  }

  return fallback;
}

function timeoutError() {
  const error = new Error('The music service took too long to respond. Please try again.');
  error.code = 'TIMEOUT';
  return error;
}

async function requestWithToken(path, options, forceRefresh = false) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('Please sign in to use King X Music.');
  }

  const token = await user.getIdToken(forceRefresh);
  const { timeoutMs, signal, headers, ...rest } = options;

  const controller =
    typeof AbortController === 'function' ? new AbortController() : null;

  let timer;
  let timedOut = false;
  const forwardAbort = () => controller?.abort();

  if (controller && signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener?.('abort', forwardAbort);
  }

  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      controller?.abort();
      reject(timeoutError());
    }, timeoutMs);
  });

  try {
    const response = await Promise.race([
      fetch(`${API_BASE_URL}${path}`, {
        ...rest,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          ...(headers || {}),
        },
        ...(controller ? { signal: controller.signal } : {}),
      }),
      timeout,
    ]);

    const text = await response.text();
    let data = {};

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('The music service returned an invalid response.');
      }
    }

    if (!response.ok) {
      const error = new Error(
        toErrorMessage(data?.error || data?.message, `Music service error (${response.status}).`)
      );
      error.status = response.status;
      throw error;
    }

    if (!data || typeof data !== 'object') {
      throw new Error('The music service returned an empty response.');
    }

    return data;
  } catch (error) {
    if (timedOut) throw timeoutError();
    if (isAbortError(error) || signal?.aborted) throw error;
    if (error instanceof TypeError) {
      throw new Error('Could not reach King X Music. Check your internet connection.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.('abort', forwardAbort);
  }
}

export async function kingXMusicApi(path, options = {}) {
  if (typeof path !== 'string' || !path.startsWith('/v1/')) {
    throw new Error('Invalid Music API path.');
  }

  const settings = {
    ...options,
    timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS,
  };

  try {
    return await requestWithToken(path, settings, false);
  } catch (error) {
    if (Number(error?.status) !== 401) throw error;
    return requestWithToken(path, settings, true);
  }
}
