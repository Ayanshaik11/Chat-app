import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Linking, Modal, Pressable, View, useWindowDimensions } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/SettingsContext';
import Btn from './Btn';
import T from './T';

const COLUMNS = 4;

// Recents grid for chat: tap photos to select (up to `max`), camera tile first.
export default function ChatGalleryPicker({ visible, max = 10, onClose, onDone, onOpenCamera }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const tile = width / COLUMNS;
  const [status, setStatus] = useState('loading');
  const [assets, setAssets] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [picked, setPicked] = useState([]);

  const load = useCallback(async (after) => {
    const page = await MediaLibrary.getAssetsAsync({ first: 60, after: after || undefined, mediaType: ['photo'], sortBy: [[MediaLibrary.SortBy.creationTime, false]] });
    setAssets((p) => (after ? [...p, ...page.assets] : page.assets));
    setCursor(page.endCursor);
    setHasMore(page.hasNextPage);
  }, []);

  useEffect(() => {
    if (!visible) return;
    setPicked([]);
    (async () => {
      setStatus('loading');
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) return setStatus('denied');
      try { await load(null); setStatus('ready'); } catch { setStatus('denied'); }
    })();
  }, [visible, load]);

  const toggle = (a) => setPicked((p) => (p.includes(a.id) ? p.filter((x) => x !== a.id) : p.length < max ? [...p, a.id] : p));

  const done = async () => {
    const list = await Promise.all(picked.map(async (id) => {
      const a = assets.find((x) => x.id === id);
      try { const info = await MediaLibrary.getAssetInfoAsync(id); return { uri: info.localUri || a.uri, type: 'image', mimeType: 'image/jpeg' }; }
      catch { return { uri: a.uri, type: 'image', mimeType: 'image/jpeg' }; }
    }));
    onDone(list);
  };

  const renderItem = ({ item }) => {
    if (item.camera) return (
      <Pressable onPress={() => { onClose(); onOpenCamera(); }} style={{ width: tile, height: tile, padding: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.inputBg }}>
        <Ionicons name="camera" size={26} color={colors.primary} />
      </Pressable>
    );
    const n = picked.indexOf(item.id) + 1;
    return (
      <Pressable onPress={() => toggle(item)} style={{ width: tile, height: tile, padding: 1 }}>
        <Image source={{ uri: item.uri }} style={{ width: '100%', height: '100%', backgroundColor: colors.inputBg, opacity: n ? 0.7 : 1 }} />
        <View style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#fff', backgroundColor: n ? colors.primary : 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center' }}>
          {n > 0 && <T size={11} weight="bold" color="#fff">{n}</T>}
        </View>
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: 50 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12 }}>
          <Pressable onPress={onClose} hitSlop={10}><T weight="medium" color="primary">Cancel</T></Pressable>
          <T weight="semibold" size={16} style={{ flex: 1, textAlign: 'center', marginRight: 40 }}>Recents</T>
        </View>
        {status === 'loading' ? <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
        : status === 'denied' ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, gap: 10 }}>
            <Ionicons name="images-outline" size={40} color={colors.primary} />
            <T weight="semibold">Photo access needed</T>
            <T color="subtext" style={{ textAlign: 'center' }}>Allow photo access in Settings to choose from your gallery.</T>
            <Btn small label="Open Settings" onPress={() => Linking.openSettings()} />
          </View>
        ) : (
          <FlatList
            data={[{ id: '__camera__', camera: true }, ...assets]}
            keyExtractor={(a) => a.id}
            numColumns={COLUMNS}
            renderItem={renderItem}
            onEndReachedThreshold={1.5}
            onEndReached={() => hasMore && load(cursor)}
            ListEmptyComponent={<T color="subtext" style={{ textAlign: 'center', marginTop: 40 }}>No photos found</T>}
          />
        )}
        {picked.length > 0 && (
          <View style={{ padding: 12, paddingBottom: 24, backgroundColor: colors.bg }}>
            <Btn label={`Add ${picked.length} photo${picked.length > 1 ? 's' : ''}`} onPress={done} />
          </View>
        )}
      </View>
    </Modal>
  );
}
