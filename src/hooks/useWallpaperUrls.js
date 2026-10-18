import { useSyncExternalStore } from 'react';
import { subscribe, getSnapshot } from '../services/wallpaperUrlStore';

/**
 * Subscribe a component to the shared signed-URL cache.
 *
 * Returns `{ urls, expiresAt, status, error }`; `urls` is keyed by wallpaper id.
 * Reading is synchronous and never triggers a network request — fetching is
 * handled by `ensureWallpaperUrls()` from an effect.
 */
export default function useWallpaperUrls() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Convenience: the signed URL for one wallpaper id (or null). */
export function useWallpaperUrl(id) {
  const snapshot = useWallpaperUrls();
  return (id && snapshot.urls[id]) || null;
}
