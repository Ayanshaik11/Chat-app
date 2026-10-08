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
*/


// ======================================================
// PICK MEDIA
// ======================================================

export async function pickMedia({
  source = 'gallery',
  video = false,
  square = false,
} = {}) {

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

    result =
      await ImagePicker.launchImageLibraryAsync(options);
  }


  // ====================================================
  // CANCELLED
  // ====================================================

  if (
    result.canceled ||
    !result.assets ||
    !result.assets.length
  ) {
    return null;
  }


  // ====================================================
  // FIRST ASSET
  // ====================================================

  return result.assets[0];
}



// ======================================================
// CHECK VIDEO
// ======================================================

export const isVideo = (asset) => {

  if (!asset) {
    return false;
  }

  return (
    asset.type === 'video' ||
    (asset.mimeType || '').toLowerCase().startsWith('video/')
  );
};



// ======================================================
// MIME TYPE
// ======================================================

export function mimeOf(asset) {

  if (!asset) {
    return 'image/jpeg';
  }

  const provided =
    String(asset.mimeType || '')
      .trim()
      .toLowerCase();

  if (provided) {
    return provided;
  }

  if (asset.type === 'video') {
    return 'video/mp4';
  }

  return 'image/jpeg';
}



// ======================================================
// EXTENSION
// ======================================================

export const extOf = (mime = '') => {

  const clean =
    String(mime)
      .toLowerCase()
      .split(';')[0]
      .trim();

  const extension =
    clean.split('/')[1] || 'jpg';

  return extension
    .replace('quicktime', 'mov')
    .replace('jpeg', 'jpg')
    .replace('svg+xml', 'svg');
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

    if (!uri) {
      reject(
        new Error('No media file was selected.')
      );
      return;
    }


    if (!CLOUDINARY_CLOUD_NAME) {
      reject(
        new Error('Cloudinary cloud name is missing.')
      );
      return;
    }


    if (!CLOUDINARY_UPLOAD_PRESET) {
      reject(
        new Error('Cloudinary upload preset is missing.')
      );
      return;
    }


    // --------------------------------------------------
    // NORMALIZE MIME
    // --------------------------------------------------

    const mime =
      String(contentType || '')
        .toLowerCase()
        .split(';')[0]
        .trim() ||
      'image/jpeg';


    // Cloudinary stores audio under the "video" resource type
    const video =
      mime.startsWith('video/') ||
      mime.startsWith('audio/');


    // --------------------------------------------------
    // EXTENSION
    // --------------------------------------------------

    let extension =
      mime.split('/')[1] ||
      (video ? 'mp4' : 'jpg');

    extension =
      extension
        .replace('quicktime', 'mov')
        .replace('jpeg', 'jpg');


    // --------------------------------------------------
    // CLOUDINARY RESOURCE TYPE
    // --------------------------------------------------
    //
    // IMPORTANT:
    //
    // image uploads → /image/upload
    // video uploads → /video/upload
    //
    // Instead of using /auto/upload for every file.
    // This is more reliable with Android multipart uploads.
    //

    const resourceType =
      video
        ? 'video'
        : 'image';


    const uploadURL =
      `https://api.cloudinary.com/v1_1/` +
      `${CLOUDINARY_CLOUD_NAME}/` +
      `${resourceType}/upload`;


    // --------------------------------------------------
    // FORM DATA
    // --------------------------------------------------

    const form =
      new FormData();


    form.append(
      'file',
      {
        uri,
        type: mime,
        name: `kingx_${Date.now()}.${extension}`,
      }
    );


    form.append(
      'upload_preset',
      CLOUDINARY_UPLOAD_PRESET
    );


    // --------------------------------------------------
    // OPTIONAL FOLDER
    // --------------------------------------------------
    //
    // The path is only used as an organizing folder.
    // Cloudinary's unsigned preset controls what is allowed.
    //

    if (path) {

      const folder =
        String(path)
          .replace(/\\/g, '/')
          .split('/')
          .slice(0, -1)
          .join('/');

      if (folder) {
        form.append('folder', folder);
      }
    }


    // --------------------------------------------------
    // XHR
    // --------------------------------------------------

    const xhr =
      new XMLHttpRequest();


    xhr.open(
      'POST',
      uploadURL
    );


    xhr.timeout = 120000;


    // --------------------------------------------------
    // PROGRESS
    // --------------------------------------------------

    xhr.upload.onprogress =
      (event) => {

        if (
          event.lengthComputable &&
          typeof onProgress === 'function'
        ) {

          const progress =
            event.total > 0
              ? event.loaded / event.total
              : 0;

          onProgress(
            Math.max(
              0,
              Math.min(1, progress)
            )
          );
        }
      };


    // --------------------------------------------------
    // SUCCESS
    // --------------------------------------------------

    xhr.onload =
      () => {

        let body = {};

        try {

          body =
            JSON.parse(
              xhr.responseText || '{}'
            );

        } catch (error) {

          body = {};
        }


        if (
          xhr.status >= 200 &&
          xhr.status < 300 &&
          body.secure_url
        ) {

          if (
            typeof onProgress === 'function'
          ) {
            onProgress(1);
          }

          resolve(
            body.secure_url
          );

          return;
        }


        const cloudinaryError =
          body?.error?.message ||
          body?.message ||
          `Cloudinary returned HTTP ${xhr.status}.`;


        reject(
          new Error(
            `Cloudinary upload failed: ${cloudinaryError}`
          )
        );
      };


    // --------------------------------------------------
    // HTTP ERROR
    // --------------------------------------------------

    xhr.onerror =
      () => {

        reject(
          new Error(
            'Network error while uploading to Cloudinary. Check your internet connection.'
          )
        );
      };


    // --------------------------------------------------
    // TIMEOUT
    // --------------------------------------------------

    xhr.ontimeout =
      () => {

        reject(
          new Error(
            'Cloudinary upload timed out. Please try again with a smaller file.'
          )
        );
      };


    // --------------------------------------------------
    // ABORT
    // --------------------------------------------------

    xhr.onabort =
      () => {

        reject(
          new Error(
            'Upload was cancelled.'
          )
        );
      };


    // --------------------------------------------------
    // SEND
    // --------------------------------------------------

    try {

      xhr.send(form);

    } catch (error) {

      reject(
        new Error(
          error?.message ||
          'Could not start the Cloudinary upload.'
        )
      );
    }
  });
}



// ======================================================
// DELETE FILE
// ======================================================
//
// Unsigned Cloudinary uploads cannot safely be deleted
// directly from the client.
//

export const deleteFile = () =>
  Promise.resolve();