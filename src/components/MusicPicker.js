
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import { searchMusic } from '../services/music';

const RED = '#E11D2A';

const fill = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

const mmss = (seconds) => {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
};

export default function MusicPicker({ initial, onPick, onClose }) {
  const { fbUser } = useAuth();

  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chosen, setChosen] = useState(initial || null);
  const [start, setStart] = useState(initial?.start || 0);
  const [playingId, setPlayingId] = useState(null);

  const sound = useRef(null);
  const requestId = useRef(0);
  const mounted = useRef(true);

  const stop = async () => {
    const current = sound.current;
    sound.current = null;

    if (current) {
      try {
        current.setOnPlaybackStatusUpdate(null);
        await current.stopAsync().catch(() => {});
        await current.unloadAsync().catch(() => {});
      } catch {}
    }

    if (mounted.current) setPlayingId(null);
  };

  const preview = async (track, from = 0) => {
    await stop();

    if (!track?.url) {
      if (mounted.current) {
        setError('No playable preview is available for this song.');
      }
      return;
    }

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: track.url },
        {
          shouldPlay: true,
          positionMillis: Math.max(0, from) * 1000,
          volume: 1,
        }
      );

      if (!mounted.current) {
        await newSound.unloadAsync().catch(() => {});
        return;
      }

      sound.current = newSound;
      setPlayingId(track.id);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) {
          if (status.error && mounted.current) {
            setError('Could not play this song preview.');
          }
          return;
        }

        if (status.didJustFinish) {
          newSound.unloadAsync().catch(() => {});
          if (sound.current === newSound) sound.current = null;
          if (mounted.current) setPlayingId(null);
        }
      });
    } catch (e) {
      if (mounted.current) {
        setPlayingId(null);
        setError(e?.message || 'Could not play this song preview.');
      }
    }
  };

  // Stop playback when the picker closes or unmounts.
  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      const current = sound.current;
      sound.current = null;

      if (current) {
        current.setOnPlaybackStatusUpdate(null);
        current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  // Search through the King X backend.
  useEffect(() => {
    const thisRequest = ++requestId.current;
    let cancelled = false;

    setLoading(true);
    setError('');

    const timer = setTimeout(async () => {
      try {
        const results = await searchMusic(q, fbUser);

        if (cancelled || thisRequest !== requestId.current) return;

        setItems(results);
      } catch (e) {
        if (cancelled || thisRequest !== requestId.current) return;

        setItems([]);
        setError(e?.message || 'Could not load music.');
      } finally {
        if (!cancelled && thisRequest === requestId.current) {
          setLoading(false);
        }
      }
    }, q.trim() ? 400 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, fbUser]);

  const choose = async (track) => {
    setChosen(track);
    setStart(0);
    setError('');
    await preview(track, 0);
  };

  const togglePreview = async (track) => {
    if (playingId === track.id) {
      await stop();
      return;
    }

    setChosen(track);
    setStart(0);
    setError('');
    await preview(track, 0);
  };

  const move = async (by) => {
    if (!chosen) return;

    const max = Math.max(0, (chosen.duration || 30) - 15);
    const next = Math.min(max, Math.max(0, start + by));

    setStart(next);
    await preview(chosen, next);
  };

  const useSong = async () => {
    if (!chosen) return;

    if (!chosen.url) {
      setError('This song does not have a playable preview.');
      return;
    }

    await stop();

    onPick({
      id: chosen.id,
      name: chosen.name,
      artist: chosen.artist,
      url: chosen.url,
      providerUrl: chosen.providerUrl || '',
      ccurl: chosen.ccurl || '',
      duration: chosen.duration || 0,
      image: chosen.image || '',
      start,
    });
  };

  const close = async () => {
    await stop();
    onClose?.();
  };

  return (
    <View style={[fill, { backgroundColor: '#0D0D0D', paddingTop: 50 }]}>
      {/* Search bar */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 14,
          gap: 12,
        }}
      >
        <Pressable onPress={close} hitSlop={10}>
          <Ionicons name="chevron-down" size={28} color="#FFFFFF" />
        </Pressable>

        <View
          style={{
            flex: 1,
            height: 44,
            borderRadius: 22,
            backgroundColor: '#1D1D1D',
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 14,
            gap: 8,
          }}
        >
          <Ionicons name="search" size={18} color="#999999" />

          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search songs or artists"
            placeholderTextColor="#777777"
            autoCorrect={false}
            returnKeyType="search"
            style={{
              flex: 1,
              color: '#FFFFFF',
              paddingVertical: 0,
            }}
          />

          {q.length > 0 && (
            <Pressable onPress={() => setQ('')} hitSlop={8}>
              <Ionicons name="close-circle" size={19} color="#888888" />
            </Pressable>
          )}
        </View>
      </View>

      <Text
        style={{
          color: '#888888',
          fontSize: 12,
          marginTop: 14,
          marginBottom: 8,
          marginHorizontal: 16,
        }}
      >
        {q.trim() ? 'Search results' : 'Discover music'}
      </Text>

      {/* Search status */}
      {loading ? (
        <ActivityIndicator color={RED} style={{ marginTop: 40 }} />
      ) : error && items.length === 0 ? (
        <View style={{ paddingHorizontal: 28, marginTop: 35, alignItems: 'center' }}>
          <Ionicons name="musical-notes-outline" size={36} color="#777777" />

          <Text
            style={{
              color: '#FF9999',
              textAlign: 'center',
              marginTop: 12,
              lineHeight: 21,
            }}
          >
            {error}
          </Text>

          <Pressable
            onPress={() => setQ((value) => value + ' ')}
            style={{
              marginTop: 16,
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 20,
              backgroundColor: RED,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>
              Retry search
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(track) => String(track.id)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: chosen ? 180 : 35 }}
          ListEmptyComponent={
            <Text
              style={{
                color: '#888888',
                textAlign: 'center',
                marginTop: 40,
                paddingHorizontal: 25,
              }}
            >
              {q.trim()
                ? 'No playable previews found. Try another song or artist.'
                : 'No playable previews are available right now.'}
            </Text>
          }
          renderItem={({ item }) => {
            const selected = chosen?.id === item.id;
            const isPlaying = playingId === item.id;

            return (
              <Pressable
                onPress={() => choose(item)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 9,
                  backgroundColor: selected ? '#251316' : 'transparent',
                }}
              >
                {item.image ? (
                  <Image
                    source={{ uri: item.image }}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 8,
                      backgroundColor: '#222222',
                    }}
                  />
                ) : (
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 8,
                      backgroundColor: '#222222',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons
                      name="musical-notes"
                      size={22}
                      color="#888888"
                    />
                  </View>
                )}

                <View style={{ flex: 1 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: '#FFFFFF',
                      fontWeight: '600',
                      fontSize: 14,
                    }}
                  >
                    {item.name}
                  </Text>

                  <Text
                    numberOfLines={1}
                    style={{
                      color: '#999999',
                      fontSize: 12,
                      marginTop: 4,
                    }}
                  >
                    {item.artist} · {mmss(item.duration)}
                  </Text>
                </View>

                <Pressable
                  onPress={(event) => {
                    event?.stopPropagation?.();
                    togglePreview(item);
                  }}
                  hitSlop={8}
                  style={{ padding: 4 }}
                >
                  <Ionicons
                    name={isPlaying ? 'pause-circle' : 'play-circle-outline'}
                    size={29}
                    color={isPlaying ? RED : '#CCCCCC'}
                  />
                </Pressable>
              </Pressable>
            );
          }}
        />
      )}

      {/* Selected song and start-position controls */}
      {chosen && (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#161616',
            paddingHorizontal: 14,
            paddingTop: 14,
            paddingBottom: 24,
            borderTopWidth: 1,
            borderTopColor: '#2A2A2A',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {chosen.image ? (
              <Image
                source={{ uri: chosen.image }}
                style={{ width: 42, height: 42, borderRadius: 7 }}
              />
            ) : null}

            <View style={{ flex: 1 }}>
              <Text
                numberOfLines={1}
                style={{ color: '#FFFFFF', fontWeight: '700' }}
              >
                {chosen.name}
              </Text>

              <Text
                numberOfLines={1}
                style={{ color: '#999999', fontSize: 12, marginTop: 3 }}
              >
                {chosen.artist}
              </Text>
            </View>

            <Pressable onPress={() => togglePreview(chosen)} hitSlop={8}>
              <Ionicons
                name={playingId === chosen.id ? 'pause-circle' : 'play-circle'}
                size={32}
                color={RED}
              />
            </Pressable>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 14,
              gap: 8,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: '#AAAAAA', fontSize: 12 }}>Start</Text>

              <Pressable
                onPress={() => move(-15)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: '#2A2A2A',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="remove" size={19} color="#FFFFFF" />
              </Pressable>

              <Text
                style={{
                  color: '#FFFFFF',
                  fontWeight: '700',
                  width: 38,
                  textAlign: 'center',
                }}
              >
                {mmss(start)}
              </Text>

              <Pressable
                onPress={() => move(15)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: '#2A2A2A',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="add" size={19} color="#FFFFFF" />
              </Pressable>
            </View>

            <Pressable
              onPress={useSong}
              style={{
                paddingHorizontal: 20,
                height: 40,
                borderRadius: 20,
                backgroundColor: RED,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>
                Use song
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
