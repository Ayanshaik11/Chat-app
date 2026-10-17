import React, { useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const MAX_W = 220;
const MAX_H = 300;

const fit = (w, h) => {
  const ratio = Number(w) > 0 && Number(h) > 0 ? w / h : 1.5;
  let width = MAX_W;
  let height = Math.round(width / ratio);
  if (height > MAX_H) { height = MAX_H; width = Math.round(height * ratio); }
  return { width, height };
};

// A GIF sent inside a chat bubble. Tap = full screen (animated).
export default function GifBubble({ url, w, h }) {
  const { width: sw, height: sh } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const size = fit(w, h);

  return (
    <View>
      <Pressable onPress={() => setOpen(true)} style={[size, styles.thumb]}>
        {!ready && (
          <View style={styles.spinner}>
            <ActivityIndicator color="#E11D2A" />
          </View>
        )}
        <Image source={{ uri: url }} onLoad={() => setReady(true)} style={styles.fill} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.viewer}>
          <Pressable style={styles.close} onPress={() => setOpen(false)} hitSlop={12}>
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
          <Image source={{ uri: url }} resizeMode="contain" style={{ width: sw, height: sh * 0.7 }} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: { borderRadius: 10, backgroundColor: '#222', overflow: 'hidden' },
  spinner: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  fill: { width: '100%', height: '100%' },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,.94)', alignItems: 'center', justifyContent: 'center' },
  close: { position: 'absolute', top: 44, left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,.6)', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
});
