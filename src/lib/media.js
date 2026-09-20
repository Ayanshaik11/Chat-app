import { Alert } from "react-native";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { storage } from "../firebase";

function picker() {
  return require("expo-image-picker");
}

// Ask for gallery access, then let the user crop a square picture
export async function pickImage({ square = true } = {}) {
  const ImagePicker = picker();
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    Alert.alert("Permission needed", "Allow photo access to pick a picture.");
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: square ? [1, 1] : [4, 5],
    quality: 0.75
  });

  if (result.canceled) return null;
  return { uri: result.assets[0].uri, type: "image" };
}

// Stories accept a picture OR a video
export async function pickStoryMedia() {
  const ImagePicker = picker();
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    Alert.alert("Permission needed", "Allow photo access to add a story.");
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images", "videos"],
    quality: 0.8,
    videoMaxDuration: 60
  });

  if (result.canceled) return null;

  const asset = result.assets[0];
  return { uri: asset.uri, type: asset.type === "video" ? "video" : "image" };
}

// Uploads a local file to Firebase Storage and returns its public URL
export async function uploadMedia(localUri, path) {
  const response = await fetch(localUri);
  const blob = await response.blob();
  const fileRef = ref(storage, path);

  await uploadBytes(fileRef, blob, { contentType: blob.type || "application/octet-stream" });
  return getDownloadURL(fileRef);
}
