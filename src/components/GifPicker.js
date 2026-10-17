import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';

import { hasGiphyKey, searchGifs, trendingGifs } from '../services/giphy';

const RED = '#E11D2A', BORDER = '#292929', MUTED = '#8F8F8F';
const COLS = 3;
const GAP = 6;

// Bottom-sheet GIF picker: trending on open, debounced search while typing.
export default function GifPicker({ visible, onClose, onPick }) {
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const reqId = useRef(0);

  const noKey = !hasGiphyKey();
  const tile = Math.floor((width - 32 - GAP * (COLS - 1)) / COLS);

  useEffect(() => {
    if (!visible || noKey) return undefined;
    const id = ++reqId.current;
    const q = query.trim();
    setLoading(true);
    setError('');
    const timer = setTimeout(async () => {
      try {
        const res = q ? await searchGifs(q) : await trendingGifs();
        if (id !== reqId.current) return;
        setGifs(res.items);
      } catch (e) {
        if (id !== reqId.current) return;
        setGifs([]);
        setError(e?.message || 'Could not load GIFs.');
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, q ? 350 : 0);
    return () => clearTimeout(timer);
  }, [visible, query, noKey]);

  // fresh search every time the sheet opens
  useEffect(() => { if (!visible) setQuery(''); }, [visible]);

  const empty = !loading && !error && !gifs.length;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.searchRow}>
            <FontAwesome name="search" size={15} color={MUTED} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search GIFs..."
              placeholderTextColor="#666"
              style={styles.search}
              autoFocus
              returnKeyType="search"
            />
            {!!query && (
              <TouchableOpacity onPress={() => setQuery('')} style={styles.clear} hitSlop={8}>
                <FontAwesome name="times" size={14} color={MUTED} />
              </TouchableOpacity>
            )}
          </View>

          {noKey ? (
            <View style={styles.state}>
              <FontAwesome name="key" size={26} color="#555" />
              <Text style={styles.stateTitle}>Giphy key required</Text>
              <Text style={styles.stateText}>Add EXPO_PUBLIC_GIPHY_API_KEY to your .env file, then restart Expo.</Text>
            </View>
          ) : loading && !gifs.length ? (
            <View style={styles.state}><ActivityIndicator color={RED} size="large" /></View>
          ) : error ? (
            <View style={styles.state}>
              <Text style={styles.stateTitle}>Couldn't load GIFs</Text>
              <Text style={styles.stateText}>{error}</Text>
            </View>
          ) : empty ? (
            <View style={styles.state}>
              <FontAwesome name="search" size={26} color="#555" />
              <Text style={styles.stateText}>No GIFs found</Text>
            </View>
          ) : (
            <FlatList
              data={gifs}
              keyExtractor={(g) => g.id}
              numColumns={COLS}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={{ flex: 1, marginTop: 10 }}
              columnWrapperStyle={{ gap: GAP, marginBottom: GAP }}
              contentContainerStyle={{ paddingBottom: 10 }}
              renderItem={({ item }) => (
                <TouchableOpacity activeOpacity={0.8} onPress={() => onPick(item)} style={{ width: tile, height: tile, borderRadius: 8, overflow: 'hidden', backgroundColor: '#222' }}>
                  <Image source={{ uri: item.url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                </TouchableOpacity>
              )}
            />
          )}

          <Text style={styles.powered}>Powered by GIPHY</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.72)', justifyContent: 'flex-end' },
  sheet: { height: '68%', backgroundColor: '#151515', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, borderTopWidth: 1, borderColor: BORDER },
  handle: { width: 42, height: 4, borderRadius: 3, backgroundColor: '#555', alignSelf: 'center', marginBottom: 13 },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0E0E0E', borderRadius: 12, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 12, height: 44 },
  search: { flex: 1, color: '#fff', fontSize: 15, marginLeft: 9, paddingVertical: 0 },
  clear: { padding: 4 },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  stateTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 10 },
  stateText: { color: MUTED, fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  powered: { color: '#555', fontSize: 11, textAlign: 'center', marginTop: 8 },
});
