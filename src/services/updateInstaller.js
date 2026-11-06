import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';

const PACKAGE_NAME = 'com.chat.app';
const ASKED_KEY = 'king_x_install_permission_asked';

const STALL_TIMEOUT_MS = 30 * 1000; // no progress for 30s = the connection is stuck
const MAX_ATTEMPTS = 4;
const MIN_APK_BYTES = 1024 * 1024;

/* =======================================================
   ONE-TIME "install unknown apps" HELP
   Android only lets an app install APKs after the person allows
   "Install unknown apps" for it. That cannot be skipped, but it is only
   needed once, so we explain it and open the exact settings page for this app.
======================================================= */

async function ensureInstallPermission() {
  try {
    if (await AsyncStorage.getItem(ASKED_KEY)) {
      return;
    }
  } catch (e) {}

  await new Promise((resolve) => {
    Alert.alert(
      'Allow updates (one time)',
      'Android needs your permission before King X can install its own updates.\n\nTap "Open settings", switch on "Allow from this source", then come back and tap Update again.',
      [
        {
          text: 'Open settings',
          onPress: async () => {
            try {
              await AsyncStorage.setItem(ASKED_KEY, '1');
              await IntentLauncher.startActivityAsync(
                'android.settings.MANAGE_UNKNOWN_APP_SOURCES',
                { data: `package:${PACKAGE_NAME}` }
              );
            } catch (e) {}
            resolve('settings');
          },
        },
        {
          text: 'Already allowed',
          onPress: async () => {
            try {
              await AsyncStorage.setItem(ASKED_KEY, '1');
            } catch (e) {}
            resolve('continue');
          },
        },
      ],
      { cancelable: false }
    );
  });
}

/* =======================================================
   DOWNLOAD (resumable, retries, stall detection)
======================================================= */

async function downloadWithRetry(url, partPath, onProgress) {
  let lastError = null;
  let resumeData = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let lastProgressAt = Date.now();
    let stalled = false;
    let watchdog = null;

    const resumable = FileSystem.createDownloadResumable(
      url,
      partPath,
      {},
      (p) => {
        lastProgressAt = Date.now();
        if (onProgress && p.totalBytesExpectedToWrite) {
          onProgress(p.totalBytesWritten / p.totalBytesExpectedToWrite);
        }
      },
      resumeData || undefined
    );

    try {
      const result = await Promise.race([
        resumeData ? resumable.resumeAsync() : resumable.downloadAsync(),
        new Promise((_, reject) => {
          watchdog = setInterval(() => {
            if (Date.now() - lastProgressAt > STALL_TIMEOUT_MS) {
              stalled = true;
              reject(new Error('The connection stalled.'));
            }
          }, 2000);
        }),
      ]);

      clearInterval(watchdog);

      if (result?.uri && (result.status === undefined || result.status === 200)) {
        return result.uri;
      }

      throw new Error(`The server answered with status ${result?.status}.`);
    } catch (error) {
      clearInterval(watchdog);
      lastError = error;

      // keep what was already downloaded so the next attempt can continue
      try {
        const saved = await resumable.pauseAsync();
        resumeData = saved?.resumeData || null;
      } catch (e) {
        resumeData = null;
      }

      if (!stalled && attempt >= 2) {
        // not a stall and already retried: don't keep looping on a hard error
        break;
      }
    }
  }

  throw new Error(
    lastError?.message
      ? `Download failed: ${lastError.message} Check your connection and try again.`
      : 'The download did not complete. Check your connection and try again.'
  );
}

/* =======================================================
   DOWNLOAD + INSTALL
   - the finished APK is kept per version, so if you cancel the installer
     (or come back later) it installs instantly with no second download
======================================================= */

export async function downloadAndInstall(url, onProgress, version = 'latest') {
  if (Platform.OS !== 'android') {
    throw new Error('In-app updates are only available on Android.');
  }

  const safeVersion = String(version).replace(/[^0-9a-zA-Z.]/g, '');
  const finalPath = `${FileSystem.cacheDirectory}king-x-${safeVersion}.apk`;
  const partPath = `${finalPath}.part`;

  await ensureInstallPermission();

  let apkUri = null;

  // reuse an APK that was already fully downloaded
  const existing = await FileSystem.getInfoAsync(finalPath);
  if (existing.exists && existing.size > MIN_APK_BYTES) {
    apkUri = finalPath;
    if (onProgress) onProgress(1);
  } else {
    await FileSystem.deleteAsync(partPath, { idempotent: true });
    const downloaded = await downloadWithRetry(url, partPath, onProgress);

    const info = await FileSystem.getInfoAsync(downloaded);
    if (!info.exists || info.size < MIN_APK_BYTES) {
      // A real APK is many MB; a tiny file usually means the link returned an
      // error/login page instead of the app (e.g. a private repository).
      await FileSystem.deleteAsync(downloaded, { idempotent: true });
      throw new Error('The downloaded file looks wrong, not a real app update. Please try again.');
    }

    await FileSystem.deleteAsync(finalPath, { idempotent: true });
    await FileSystem.moveAsync({ from: downloaded, to: finalPath });
    apkUri = finalPath;
  }

  // remove older downloaded updates
  try {
    const files = await FileSystem.readDirectoryAsync(FileSystem.cacheDirectory);
    await Promise.all(
      files
        .filter((f) => /^king-x-.*\.apk(\.part)?$/.test(f) && `${FileSystem.cacheDirectory}${f}` !== finalPath)
        .map((f) => FileSystem.deleteAsync(`${FileSystem.cacheDirectory}${f}`, { idempotent: true }))
    );
  } catch (e) {}

  const contentUri = await FileSystem.getContentUriAsync(apkUri);

  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
    type: 'application/vnd.android.package-archive',
  });
}
