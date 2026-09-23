import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';

const DOWNLOAD_TIMEOUT_MS = 90 * 1000;

// Downloads the new APK straight into the app's storage and hands it to
// Android's own installer — the normal system "Install update?" screen,
// never a browser tab or a link to tap. Times out instead of hanging forever
// (e.g. if the link needs a login it doesn't have).
export async function downloadAndInstall(url, onProgress) {
  const dest = FileSystem.cacheDirectory + 'chat-app-update.apk';
  const resumable = FileSystem.createDownloadResumable(url, dest, {}, (p) => {
    if (onProgress && p.totalBytesExpectedToWrite) onProgress(p.totalBytesWritten / p.totalBytesExpectedToWrite);
  });

  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('The download is taking too long. Check your connection and try again.')), DOWNLOAD_TIMEOUT_MS)
  );

  const result = await Promise.race([resumable.downloadAsync(), timeout]);
  if (!result?.uri) throw new Error('The download did not complete. Check your connection and try again.');

  const info = await FileSystem.getInfoAsync(result.uri);
  if (!info.exists || info.size < 1024 * 1024) {
    // A real APK is many MB; a tiny file usually means the link returned an
    // error/login page instead of the app (e.g. a private repository).
    await FileSystem.deleteAsync(result.uri, { idempotent: true });
    throw new Error('The downloaded file looks wrong, not a real app update. Please try again.');
  }

  const contentUri = await FileSystem.getContentUriAsync(result.uri);
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
    type: 'application/vnd.android.package-archive',
  });
}
