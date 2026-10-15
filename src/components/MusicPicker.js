import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, Text, TextInput, View } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { searchMusic } from '../services/music';

const RED = '#E11D2A';
const fill = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// Free song picker (Creative Commons music): search, preview, choose where the song starts.
export default function MusicPicker({ initial, onPick, onClose }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chosen, setChosen] = useState(initial || null);
  const [start, setStart] = useState(initial?.start || 0);
  const sound = useRef(null);

  const stop = async () => { const s = sound.current; sound.current = null; if (s) await s.unloadAsync().catch(() => {}); };
  const preview = async (track, from) => {
    await stop();
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound: s } = await Audio.Sound.createAsync({ uri: track.url }, { shouldPlay: true, positionMillis: from * 1000 });
      sound.current = s;
    } catch { setError('Could not play this song.'); }
  };

  useEffect(() => () => { stop(); }, []);

  // search (trending when empty), 0.5s after typing stops
  useEffect(() => {
    setLoading(true); setError('');
    const t = setTimeout(() => searchMusic(q).then(setItems).catch((e) => setError(e.message)).finally(() => setLoading(false)), q ? 500 : 0);
    return () => clearTimeout(t);
  }, [q]);

  const choose = (track) => { setChosen(track); setStart(0); preview(track, 0); };
  const move = (by) => {
    const max = Math.max(0, (chosen.duration || 30) - 15);
    const next = Math.min(max, Math.max(0, start + by));
    setStart(next); preview(chosen, next);
  };
  const use = async () => { await stop(); onPick({ id: chosen.id, name: chosen.name, artist: chosen.artist, url: chosen.url, ccurl: chosen.ccurl, start }); };
  const close = async () => { await stop(); onClose(); };

  return (
    <View style={[fill, { backgroundColor: '#0D0D0D', paddingTop: 50 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 12 }}>
        <Pressable onPress={close} hitSlop={10}><Ionicons name="chevron-down" size={28} color="#fff" /></Pressable>
        <View style={{ flex: 1, height: 42, borderRadius: 21, backgroundColor: '#1d1d1d', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 8 }}>
          <Ionicons name="search" size={18} color="#999" />
          <TextInput value={q} onChangeText={setQ} placeholder="Search free music" placeholderTextColor="#777" style={{ flex: 1, color: '#fff' }} />
        </View>
      </View>

      <Text style={{ color: '#888', fontSize: 12, marginTop: 12, marginHorizontal: 16 }}>{q ? 'Results' : 'Trending this week'} · free music, artists are credited</Text>

      {loading ? <ActivityIndicator color={RED} style={{ marginTop: 40 }} /> : error ? <Text style={{ color: '#ff8a8a', textAlign: 'center', marginTop: 40, paddingHorizontal: 30 }}>{error}</Text> : (
        <FlatList
          data={items}
          keyExtractor={(t) => t.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 150 }}
          ListEmptyComponent={<Text style={{ color: '#888', textAlign: 'center', marginTop: 40 }}>No songs found</Text>}
          renderItem={({ item }) => {
            const on = chosen?.id === item.id;
            return (
              <Pressable onPress={() => choose(item)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: on ? '#1a1214' : 'transparent' }}>
                {item.image ? <Image source={{ uri: item.image }} style={{ width: 46, height: 46, borderRadius: 8, backgroundColor: '#222' }} /> : <View style={{ width: 46, height: 46, borderRadius: 8, backgroundColor: '#222' }} />}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontWeight: '600' }} numberOfLines={1}>{item.name}</Text>
                  <Text style={{ color: '#999', fontSize: 12 }} numberOfLines={1}>{item.artist} · {mmss(item.duration || 0)}</Text>
                </View>
                <Ionicons name={on ? 'musical-notes' : 'play-circle-outline'} size={26} color={on ? RED : '#bbb'} />
              </Pressable>
            );
          }}
        />
      )}

      {chosen && (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#161616', padding: 14, paddingBottom: 22, borderTopWidth: 1, borderTopColor: '#2a2a2a' }}>
          <Text style={{ color: '#fff', fontWeight: '700' }} numberOfLines={1}>{chosen.name} · {chosen.artist}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ color: '#aaa' }}>Start at</Text>
              <Pressable onPress={() => move(-15)} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="remove" size={20} color="#fff" /></Pressable>
              <Text style={{ color: '#fff', fontWeight: '700', width: 40, textAlign: 'center' }}>{mmss(start)}</Text>
              <Pressable onPress={() => move(15)} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="add" size={20} color="#fff" /></Pressable>
            </View>
            <Pressable onPress={use} style={{ paddingHorizontal: 22, height: 40, borderRadius: 20, backgroundColor: RED, justifyContent: 'center' }}><Text style={{ color: '#fff', fontWeight: '700' }}>Use song</Text></Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
