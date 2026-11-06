import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import { checkForUpdate } from '../services/appVersion';
import { downloadAndInstall } from '../services/updateInstaller';

// Retry delays (ms) when the first check can't reach Firestore (slow network at launch).
const RETRY_DELAYS = [0, 4000, 12000, 30000];
// When the app comes back to the foreground, check again if the last check is older than this.
const RECHECK_AFTER_MS = 10 * 60 * 1000;

// Checks Firestore at launch (with retries) and every time the app returns to the
// foreground. Returns state for <UpdateCard/>. On Android it downloads and
// installs in place; it never needs a browser link.
export default function useUpdateCheck() {
  const [info, setInfo] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const aliveRef = useRef(true);
  const runningRef = useRef(false);
  const lastOkRef = useRef(0);

  const runCheck = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;

    try {
      for (let i = 0; i < RETRY_DELAYS.length; i += 1) {
        if (RETRY_DELAYS[i]) {
          await new Promise((r) => setTimeout(r, RETRY_DELAYS[i]));
        }
        if (!aliveRef.current) return;

        const result = await checkForUpdate();
        if (!aliveRef.current) return;

        if (result.checked) {
          lastOkRef.current = Date.now();
          if (result.info) {
            setInfo((prev) =>
              prev && prev.latestVersion === result.info.latestVersion ? prev : result.info
            );
          }
          return;
        }
      }
    } finally {
      runningRef.current = false;
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    runCheck();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && Date.now() - lastOkRef.current > RECHECK_AFTER_MS) {
        runCheck();
      }
    });

    return () => {
      aliveRef.current = false;
      sub.remove();
    };
  }, [runCheck]);

  const install = useCallback(async () => {
    if (!info?.url) {
      setError('The update link is missing. Please download the latest version from the King X download page.');
      return;
    }
    if (Platform.OS !== 'android') {
      // Apple does not allow apps to self-install outside the App Store/TestFlight.
      Linking.openURL(info.url).catch(() => setError('Could not open the update link.'));
      return;
    }
    setError('');
    setDownloading(true);
    setProgress(0);
    try {
      await downloadAndInstall(info.url, setProgress, info.latestVersion);
    } catch (e) {
      setError(e.message || 'Could not install the update.');
    } finally {
      setDownloading(false);
    }
  }, [info]);

  const dismiss = useCallback(() => setDismissed(true), []);

  return { info, visible: !!info && !dismissed, downloading, progress, error, install, dismiss };
}
