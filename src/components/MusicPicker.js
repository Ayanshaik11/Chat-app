
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

import {
  getTrackPreview,
  isAbortError,
  searchMusic,
  toErrorMessage,
  toSelectedMusic,
} from '../services/music';

const RED = '#E11D2A';

const CATEGORIES = [
  { id: 'latest', label: '🔥 New', query: 'latest songs' },
  { id: 'trending', label: '⚡ Trending', query: 'trending songs' },
  { id: 'bollywood', label: '🎬 Bollywood', query: 'bollywood hits' },
  { id: 'punjabi', label: '💥 Punjabi', query: 'punjabi hits' },
  { id: 'romantic', label: '❤️ Romantic', query: 'romantic songs' },
];

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
  const [q, setQ] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('latest');
  const [reloadKey, setReloadKey] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chosen, setChosen] = useState(
    initial
      ? {
          ...initial,
          name: initial.name || initial.title,
          image: initial.image || initial.artwork,
          url: initial.url || initial.previewUrl,
        }
      : null
  );
  const [start, setStart] = useState(initial?.start || 0);
  const [playingId, setPlayingId] = useState(null);

  const sound = useRef(null);
  const requestId = useRef(0);
  const mounted = useRef(true);
  const lastQuery = useRef('latest songs');

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

  // Preview URLs can expire. Before giving up, ask the backend for a fresh one.
  const refreshPreview = async (track) => {
    if (!track?.id) return track;

    const query =
      track.searchQuery ||
      lastQuery.current ||
      [track.name || track.title, track.artist].filter(Boolean).join(' ');

    try {
      const fresh = await getTrackPreview(track.id, query, {
        timeoutMs: 8000,
      });
      const freshValues = Object.fromEntries(
        Object.entries(fresh).filter(([, value]) => value !== '' && value != null)
      );
      const updated = { ...track, ...freshValues };

      if (mounted.current) {
        setItems((list) =>
          list.map((item) =>
            item.id === track.id ? { ...item, ...freshValues } : item
          )
        );
        setChosen((current) =>
          current?.id === track.id ? { ...current, ...freshValues } : current
        );
      }

      return updated;
    } catch {
      // Keep the URL we already have; the caller decides whether it is usable.
      return track;
    }
  };

  const isRestricted = (track) =>
    !!(track?.disabled || track?.isDrm);

  const restrictionMessage = (track) =>
    track?.disabledText || track?.rightsReason ||
    'This track is restricted by the music provider.';

  const preview = async (track, from = 0, retry = true) => {
    await stop();

    if (!track?.url && retry) {
      track = await refreshPreview(track);
    }

    if (isRestricted(track)) {
      if (mounted.current) {
        setPlayingId(null);
        setError(restrictionMessage(track));
      }
      return;
    }

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
      if (retry) {
        const fresh = await refreshPreview(track);

        if (fresh?.url && fresh.url !== track.url) {
          if (mounted.current) setError('');
          await preview(fresh, from, false);
          return;
        }
      }

      if (mounted.current) {
        setPlayingId(null);
        setError(
          toErrorMessage(
            e,
            'Could not play this song preview. The preview may have expired.'
          )
        );
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

  // Search or discover songs through the King X backend.
  useEffect(() => {
    const thisRequest = ++requestId.current;
    const controller =
      typeof AbortController === 'function' ? new AbortController() : null;
    let cancelled = false;

    setLoading(true);
    setError('');

    const activeCat = CATEGORIES.find((c) => c.id === selectedCategory);
    const queryToSearch = q.trim() || activeCat?.query || 'latest songs';

    const timer = setTimeout(async () => {
      try {
        const results = await searchMusic(queryToSearch, {
          ...(controller ? { signal: controller.signal } : {}),
        });

        if (cancelled || thisRequest !== requestId.current) return;

        lastQuery.current = queryToSearch;
        setItems(results);
      } catch (e) {
        if (
          cancelled ||
          thisRequest !== requestId.current ||
          isAbortError(e)
        ) {
          return;
        }

        setItems([]);
        setError(toErrorMessage(e, 'Could not load music.'));
      } finally {
        if (!cancelled && thisRequest === requestId.current) {
          setLoading(false);
        }
      }
    }, q.trim() ? 400 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller?.abort();
    };
  }, [q, selectedCategory, reloadKey]);

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


  const useSong = async () => {
    if (!chosen) return;

    const track = chosen.url ? chosen : await refreshPreview(chosen);

    if (isRestricted(track)) {
      setError(restrictionMessage(track));
      return;
    }

    if (!track?.url) {
      setError('This song does not have a playable preview.');
      return;
    }

    await stop();

    try {
      onPick(toSelectedMusic(track, start));
    } catch (e) {
      setError(toErrorMessage(e, 'Could not use this song.'));
    }
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

      {/* Category filter pills */}
      <View style={{ marginTop: 12 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          keyboardShouldPersistTaps="handled"
        >
          {CATEGORIES.map((cat) => {
            const active = !q.trim() && selectedCategory === cat.id;
            return (
              <Pressable
                key={cat.id}
                onPress={() => {
                  setQ('');
                  setSelectedCategory(cat.id);
                }}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 18,
                  backgroundColor: active ? RED : '#1D1D1D',
                  borderWidth: 1,
                  borderColor: active ? RED : '#2E2E2E',
                }}
              >
                <Text
                  style={{
                    color: active ? '#FFFFFF' : '#CCCCCC',
                    fontSize: 13,
                    fontWeight: active ? '700' : '500',
                  }}
                >
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
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
        {q.trim()
          ? 'Search results'
          : `${CATEGORIES.find((c) => c.id === selectedCategory)?.label || 'New'} songs`}
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
            onPress={() => setReloadKey((k) => k + 1)}
            style={{
              marginTop: 16,
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 20,
              backgroundColor: RED,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>
              Retry
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(track) => String(track.id)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: chosen ? 150 : 35 }}
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
                ? 'No songs found. Try another song or artist.'
                : 'No songs are available right now.'}
            </Text>
          }
          renderItem={({ item }) => {
            const selected = chosen?.id === item.id;
            const isPlaying = playingId === item.id;
            const hasPreview = !!item.url;

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
                    {item.artist}
                    {hasPreview ? ` · ${mmss(item.duration)}` : ' · Preview unavailable'}
                  </Text>

                  <Text
                    numberOfLines={1}
                    style={{
                      color: item.source === 'itunes' ? '#8AB4F8' : '#8BD5A7',
                      fontSize: 10,
                      marginTop: 3,
                    }}
                  >
                    {item.source === 'itunes' ? 'Apple Music · Preview clip' : 'JioSaavn'}
                  </Text>
                </View>

                <Pressable
                  onPress={(event) => {
                    event?.stopPropagation?.();
                    togglePreview(item);
                  }}
                  disabled={!hasPreview}
                  hitSlop={8}
                  style={{ padding: 4 }}
                >
                  <Ionicons
                    name={isPlaying ? 'pause-circle' : 'play-circle-outline'}
                    size={29}
                    color={isPlaying ? RED : hasPreview ? '#CCCCCC' : '#555555'}
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
            {chosen.image || chosen.artwork ? (
              <Image
                source={{ uri: chosen.image || chosen.artwork }}
                style={{ width: 42, height: 42, borderRadius: 7 }}
              />
            ) : null}

            <View style={{ flex: 1 }}>
              <Text
                numberOfLines={1}
                style={{ color: '#FFFFFF', fontWeight: '700' }}
              >
                {chosen.name || chosen.title}
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

          <Pressable
            onPress={useSong}
            style={{
              marginTop: 14,
              height: 42,
              borderRadius: 21,
              backgroundColor: RED,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>
              Use song
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
