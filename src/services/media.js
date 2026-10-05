import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import {
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_UPLOAD_PRESET,
} from '../config/cloudinary';

/*
========================================================
 KING X MEDIA UTILITY
========================================================

Default behavior:

    pickMedia()
        ↓
    Opens media gallery directly

No:
    "Choose Gallery or Camera?" popup

Use:

    pickMedia()
        → Images

    pickMedia({ video: true })
        → Images + Videos

    pickMedia({ square: true })
        → Profile-picture style 1:1 crop

    pickMedia({ source: 'camera' })
        → Camera directly

========================================================
*/


// ======================================================
// PICK MEDIA
// ======================================================

export async function pickMedia({
  source = 'gallery',
  video = false,
  square = false,
} = {}) {

  // ----------------------------------------------------
  // COMMON OPTIONS
  // ----------------------------------------------------

  const options = {
    mediaTypes: video
      ? ImagePicker.MediaTypeOptions.All
      : ImagePicker.MediaTypeOptions.Images,

    allowsEditing: square,

    aspect: square
      ? [1, 1]
      : undefined,

    quality: 0.7,

    videoMaxDuration: 30,
  };


  let result;


  // ====================================================
  // CAMERA
  // ====================================================

  if (source === 'camera') {

    const permission =
      await ImagePicker.requestCameraPermissionsAsync();


    if (!permission.granted) {

      Alert.alert(
        'Camera Permission Needed',
        'Please allow camera access in your phone settings.'
      );

      return null;
    }


    result =
      await ImagePicker.launchCameraAsync(options);
  }


  // ====================================================
  // GALLERY
  // ====================================================

  else {

    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();


    if (!permission.granted) {

      Alert.alert(
        'Photos Permission Needed',
        'Please allow access to your photos and videos.'
      );

      return null;
    }


    // IMPORTANT:
    // Gallery opens DIRECTLY.
    //
    // There is NO Gallery/Camera Alert here.

    result =
      await ImagePicker.launchImageLibraryAsync(options);
  }


  // ====================================================
  // USER CANCELLED
  // ====================================================

  if (
    result.canceled ||
    !result.assets ||
    !result.assets.length
  ) {
    return null;
  }


  // ====================================================
  // RETURN FIRST SELECTED FILE
  // ====================================================

  return result.assets[0];
}



// ======================================================
// CHECK WHETHER MEDIA IS VIDEO
// ======================================================

export const isVideo = (asset) => {

  if (!asset) {
    return false;
  }


  return (
    asset.type === 'video' ||
    (asset.mimeType || '').startsWith('video')
  );
};



// ======================================================
// GET MIME TYPE
// ======================================================

export function mimeOf(asset) {

  if (!asset) {
    return 'image/jpeg';
  }


  if (asset.mimeType) {
    return asset.mimeType;
  }


  return isVideo(asset)
    ? 'video/mp4'
    : 'image/jpeg';
}



// ======================================================
// GET FILE EXTENSION
// ======================================================

export const extOf = (mime = '') => {

  return (
    mime.split('/')[1] || 'jpg'
  )
    .replace('quicktime', 'mov')
    .replace('jpeg', 'jpg');
};



// ======================================================
// CLOUDINARY UPLOAD
// ======================================================

export function uploadFile(
  uri,
  path,
  contentType,
  onProgress
) {

  return new Promise((resolve, reject) => {

    const isVid =
      (contentType || '').startsWith('video');


    const ext =
      (contentType || '').split('/')[1] ||
      (isVid ? 'mp4' : 'jpg');


    // --------------------------------------------------
    // FORM DATA
    // --------------------------------------------------

    const form =
      new FormData();


    form.append(
      'file',
      {
        uri,
        type: contentType,
        name: `upload.${ext}`,
      }
    );


    form.append(
      'upload_preset',
      CLOUDINARY_UPLOAD_PRESET
    );


    // --------------------------------------------------
    // XHR
    // --------------------------------------------------

    const xhr =
      new XMLHttpRequest();


    xhr.open(
      'POST',
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`
    );


    // --------------------------------------------------
    // UPLOAD PROGRESS
    // --------------------------------------------------

    xhr.upload.onprogress = (event) => {

      if (
        event.lengthComputable &&
        onProgress
      ) {

        onProgress(
          event.loaded / event.total
        );
      }
    };


    // --------------------------------------------------
    // SUCCESS / ERROR
    // --------------------------------------------------

    xhr.onload = () => {

      let body = {};


      try {

        body =
          JSON.parse(
            xhr.responseText
          );

      } catch (error) {

        body = {};
      }


      if (
        xhr.status >= 200 &&
        xhr.status < 300 &&
        body.secure_url
      ) {

        resolve(
          body.secure_url
        );

      } else {

        reject(
          new Error(
            body?.error?.message ||
            'Upload failed. Check your Cloudinary name and upload preset.'
          )
        );
      }
    };


    // --------------------------------------------------
    // NETWORK ERROR
    // --------------------------------------------------

    xhr.onerror = () => {

      reject(
        new Error(
          'Network error while uploading.'
        )
      );
    };


    // --------------------------------------------------
    // START UPLOAD
    // --------------------------------------------------

    xhr.send(form);
  });
}



// ======================================================
// DELETE FILE
// ======================================================
//
// Cloudinary unsigned uploads cannot safely be deleted
// directly from the client.
//
// Firestore post/story removal is handled separately.
//

export const deleteFile = () =>
  Promise.resolve();