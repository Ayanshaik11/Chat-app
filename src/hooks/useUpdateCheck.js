import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';
import { fetchUpdateInfo } from '../services/appVersion';
import { downloadAndInstall } from '../services/updateInstaller';

// Checks Firestore once per launch. Returns state for <UpdateCard/> to show —
// this never uses a browser link on Android; it downloads and installs in place.
export default function useUpdateCheck() {
  const [info, setInfo] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    fetchUpdateInfo()
      .then((i) => alive && setInfo(i))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const install = useCallback(async () => {
    if (!info?.url) return;
    if (Platform.OS !== 'android') {
      // Apple does not allow apps to self-install outside the App Store/TestFlight.
      Linking.openURL(info.url).catch(() => setError('Could not open the update link.'));
      return;
    }
    setError('');
    setDownloading(true);
    setProgress(0);
    try {
      await downloadAndInstall(info.url, setProgress);
    } catch (e) {
      setError(e.message || 'Could not install the update.');
    } finally {
      setDownloading(false);
    }
  }, [info]);

  const dismiss = useCallback(() => setDismissed(true), []);

  return { info, visible: !!info && !dismissed, downloading, progress, error, install, dismiss };
}
