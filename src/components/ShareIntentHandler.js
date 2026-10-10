import { useEffect } from 'react';
import { useShareIntentContext } from 'expo-share-intent';
import { useAuth } from '../context/AuthContext';
import { navigationRef } from '../navigation/navigationRef';

/**
 * Listens for content shared INTO King X from other apps (YouTube, Instagram, ...)
 * and opens the "Send to" picker. Renders nothing.
 */
export default function ShareIntentHandler() {
  const { me } = useAuth();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();

  useEffect(() => {
    if (!hasShareIntent || !me?.id) return undefined; // wait until logged in

    const text = String(shareIntent?.webUrl || shareIntent?.text || '').trim();
    if (!text) {
      resetShareIntent();
      return undefined;
    }

    // navigator may not be mounted yet on a cold start - retry briefly
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (navigationRef.isReady()) {
        clearInterval(timer);
        navigationRef.navigate('SharePicker', { text });
        resetShareIntent();
      } else if (tries > 40) {
        clearInterval(timer);
        resetShareIntent();
      }
    }, 150);

    return () => clearInterval(timer);
  }, [hasShareIntent, shareIntent, me?.id, resetShareIntent]);

  return null;
}
