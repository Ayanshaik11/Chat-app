import React from 'react';
import { Image, Modal, Pressable, StatusBar, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Full-screen profile picture viewer. Tap anywhere (or the X) to close.
 * Usage: <ProfilePicViewer visible={bool} uri={url} onClose={() => ...} />
 */
export default function ProfilePicViewer({ visible, uri, onClose }) {
  const { width, height } = useWindowDimensions();
  if (!uri) return null;
  const size = Math.min(width, height * 0.8);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar backgroundColor="rgba(0,0,0,0.95)" />
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' }}
      >
        <Pressable onPress={onClose} hitSlop={12} style={{ position: 'absolute', top: 48, right: 20, zIndex: 2 }}>
          <Ionicons name="close" size={30} color="#fff" />
        </Pressable>
        <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="contain" />
      </Pressable>
    </Modal>
  );
}
