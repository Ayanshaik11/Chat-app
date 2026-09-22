import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';

// Downloads the new APK straight into the app's storage and hands it to
// Android's own installer — the normal system "Install update?" screen,
// never a browser tab or a link to tap.
export async function downloadAndInstall(url, onProgress) {
  const dest = FileSystem.cacheDirectory + 'chat-app-update.apk';
  const resumable = FileSystem.createDownloadResumable(url, dest, {}, (p) => {
    if (onProgress && p.totalBytesExpectedToWrite) onProgress(p.totalBytesWritten / p.totalBytesExpectedToWrite);
  });
  const result = await resumable.downloadAsync();
  if (!result?.uri) throw new Error('The download did not complete. Check your connection and try again.');
  const contentUri = await FileSystem.getContentUriAsync(result.uri);
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
    type: 'application/vnd.android.package-archive',
  });
}
