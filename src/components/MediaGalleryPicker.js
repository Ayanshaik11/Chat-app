import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Linking, Modal, Pressable, View, useWindowDimensions } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/SettingsContext';
import Btn from './Btn';
import T from './T';

const COLUMNS = 4;
const PAGE_SIZE = 60;

// Shows recent photos/videos directly inside the app — tapping Add/Change
// opens this grid immediately, the way Instagram does, instead of handing
// off to Android's generic file picker.
export default function MediaGalleryPicker({ visible, allowVideo, onClose, onSelect, onOpenCamera }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const tile = width / COLUMNS;
  const [status, setStatus] = useState('loading'); // 'loading' | 'denied' | 'ready'
  const [assets, setAssets] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadPage = useCallback(
    async (after) => {
      const page = await MediaLibrary.getAssetsAsync({
        first: PAGE_SIZE,
        after: after || undefined,
        mediaType: allowVideo ? ['photo', 'video'] : ['photo'],
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
      });
      setAssets((prev) => (after ? [...prev, ...page.assets] : page.assets));
      setCursor(page.endCursor);
      setHasMore(page.hasNextPage);
    },
    [allowVideo]
  );

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    (async () => {
      setStatus('loading');
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!alive) return;
      if (!perm.granted) {
        setStatus('denied');
        return;
      }
      try {
        await loadPage(null);
        if (alive) setStatus('ready');
      } catch {
        if (alive) setStatus('denied');
      }
    })();
    return () => {
      alive = false;
    };
  }, [visible, loadPage]);

  const onEndReached = () => {
    if (!hasMore || loadingMore || status !== 'ready') return;
    setLoadingMore(true);
    loadPage(cursor).finally(() => setLoadingMore(false));
  };

  const choose = async (asset) => {
    try {
      const info = await MediaLibrary.getAssetInfoAsync(asset.id);
      const isVideo = asset.mediaType === 'video';
      onSelect({
        uri: info.localUri || asset.uri,
        type: isVideo ? 'video' : 'image',
        mimeType: isVideo ? 'video/mp4' : 'image/jpeg',
        width: asset.width,
        height: asset.height,
      });
    } catch {
      // fall back to the lower-res URI if the full asset lookup fails
      const isVideo = asset.mediaType === 'video';
      onSelect({ uri: asset.uri, type: isVideo ? 'video' : 'image', mimeType: isVideo ? 'video/mp4' : 'image/jpeg' });
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: 50 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12 }}>
          <Pressable onPress={onClose} hitSlop={10}>
            <T weight="medium" color="primary">Cancel</T>
          </Pressable>
          <T weight="semibold" size={16} style={{ flex: 1, textAlign: 'center', marginRight: 40 }}>Recents</T>
        </View>

        {status === 'loading' ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
        ) : status === 'denied' ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, gap: 10 }}>
            <Ionicons name="images-outline" size={40} color={colors.primary} />
            <T weight="semibold" style={{ textAlign: 'center' }}>Photo access needed</T>
            <T color="subtext" style={{ textAlign: 'center' }}>
              Allow photo access in Settings to choose from your gallery.
            </T>
            <Btn small label="Open Settings" onPress={() => Linking.openSettings()} style={{ marginTop: 6 }} />
          </View>
        ) : (
          <FlatList
            // A sentinel item puts the camera tile truly inline as the first
            // grid cell (a ListHeaderComponent would render as its own row
            // instead, not aligned with the photo columns).
            data={onOpenCamera ? [{ id: '__camera__', isCameraTile: true }, ...assets] : assets}
            keyExtractor={(a) => a.id}
            numColumns={COLUMNS}
            onEndReachedThreshold={1.5}
            onEndReached={onEndReached}
            renderItem={({ item }) =>
              item.isCameraTile ? (
                <Pressable
                  onPress={() => {
                    onClose();
                    onOpenCamera();
                  }}
                  style={{ width: tile, height: tile, padding: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.inputBg }}
                >
                  <Ionicons name="camera" size={26} color={colors.primary} />
                </Pressable>
              ) : (
                <Pressable onPress={() => choose(item)} style={{ width: tile, height: tile, padding: 1 }}>
                  <Image source={{ uri: item.uri }} style={{ width: '100%', height: '100%', backgroundColor: colors.inputBg }} />
                  {item.mediaType === 'video' ? (
                    <View style={{ position: 'absolute', right: 4, bottom: 4 }}>
                      <Ionicons name="videocam" size={16} color="#fff" />
                    </View>
                  ) : null}
                </Pressable>
              )
            }
            ListFooterComponent={
              loadingMore ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} /> : null
            }
            ListEmptyComponent={<T color="subtext" style={{ textAlign: 'center', marginTop: 40 }}>No photos found</T>}
          />
        )}
      </View>
    </Modal>
  );
}
