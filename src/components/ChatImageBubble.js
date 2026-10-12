import React, { useState } from 'react';
import { FlatList, Image, Modal, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const W = 220;

// Photos inside a chat bubble (1 big, 2+ in a grid). Tap = full screen, swipe between photos.
export default function ChatImageBubble({ images = [] }) {
  const { width, height } = useWindowDimensions();
  const [open, setOpen] = useState(-1);
  const shown = images.slice(0, 4);
  const size = images.length === 1 ? { width: W, height: 260 } : { width: (W - 4) / 2, height: (W - 4) / 2 };

  return (
    <View>
      <View style={{ width: W, flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
        {shown.map((uri, i) => (
          <Pressable key={uri + i} onPress={() => setOpen(i)}>
            <Image source={{ uri }} style={{ ...size, borderRadius: 10, backgroundColor: '#222' }} />
            {i === 3 && images.length > 4 && (
              <View style={{ ...size, position: 'absolute', borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>+{images.length - 4}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      <Modal visible={open >= 0} animationType="fade" onRequestClose={() => setOpen(-1)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <FlatList
            data={images}
            horizontal
            pagingEnabled
            initialScrollIndex={Math.max(open, 0)}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            keyExtractor={(u, i) => u + i}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setOpen(Math.round(e.nativeEvent.contentOffset.x / width))}
            renderItem={({ item }) => <Image source={{ uri: item }} resizeMode="contain" style={{ width, height }} />}
          />
          <Pressable onPress={() => setOpen(-1)} hitSlop={12} style={{ position: 'absolute', top: 44, left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
          {images.length > 1 && <Text style={{ position: 'absolute', top: 54, alignSelf: 'center', color: '#fff', fontSize: 14 }}>{open + 1} / {images.length}</Text>}
        </View>
      </Modal>
    </View>
  );
}
