import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from '../config/cloudinary';

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

// Uploads a photo/video to Cloudinary (free, no card needed) and returns its https URL.
// "path" is kept only so the rest of the app does not change.
export function uploadFile(uri, path, contentType, onProgress) {
  return new Promise((resolve, reject) => {
    const isVid = (contentType || '').startsWith('video');
    const ext = (contentType || '').split('/')[1] || (isVid ? 'mp4' : 'jpg');
    const form = new FormData();
    form.append('file', { uri, type: contentType, name: `upload.${ext}` });
    form.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      let body = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300 && body.secure_url) resolve(body.secure_url);
      else reject(new Error(body?.error?.message || 'Upload failed. Check your Cloudinary name and preset.'));
    };
    xhr.onerror = () => reject(new Error('Network error while uploading.'));
    xhr.send(form);
  });
}

// Files on Cloudinary are not deleted from the app (free/unsigned mode); the post/story is removed from Firestore.
export const deleteFile = () => Promise.resolve();
