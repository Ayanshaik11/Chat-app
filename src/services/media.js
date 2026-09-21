import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../config/firebase';

// source: 'gallery' | 'camera'. video=true allows videos too (stories only)
export async function pickMedia({ source = 'gallery', video = false, square = false } = {}) {
  const options = {
    mediaTypes: video ? ImagePicker.MediaTypeOptions.All : ImagePicker.MediaTypeOptions.Images,
    allowsEditing: square,
    aspect: square ? [1, 1] : undefined,
    quality: 0.7,
    videoMaxDuration: 30,
  };
  let result;
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera permission needed', 'Allow camera access in your phone settings.');
      return null;
    }
    result = await ImagePicker.launchCameraAsync(options);
  } else {
    result = await ImagePicker.launchImageLibraryAsync(options);
  }
  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0];
}

export const isVideo = (asset) =>
  asset?.type === 'video' || (asset?.mimeType || '').startsWith('video');

export function mimeOf(asset) {
  if (asset?.mimeType) return asset.mimeType;
  return isVideo(asset) ? 'video/mp4' : 'image/jpeg';
}

export const extOf = (mime) => (mime.split('/')[1] || 'jpg').replace('quicktime', 'mov').replace('jpeg', 'jpg');

export async function uploadFile(uri, path, contentType, onProgress) {
  const blob = await (await fetch(uri)).blob();
  const r = ref(storage, path);
  await new Promise((resolve, reject) => {
    const task = uploadBytesResumable(r, blob, { contentType });
    task.on(
      'state_changed',
      (s) => onProgress && onProgress(s.bytesTransferred / s.totalBytes),
      reject,
      resolve
    );
  });
  return getDownloadURL(r);
}

export const deleteFile = (path) => (path ? deleteObject(ref(storage, path)).catch(() => {}) : Promise.resolve());
