
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
  getCachedSearch,
  getPlaybackVerification,
  getTrackPreview,
  isAbortError,
  isTrackPlayable,
  searchMusic,
  toErrorMessage,
  toSelectedMusic,
} from '../services/music';

const RED = '#E11D2A';

let audioModePromise = null;

function ensureAudioMode() {
  if (!audioModePromise) {
    audioModePromise = Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    }).catch(() => {
      audioModePromise = null;
    });
  }

  return audioModePromise;
}

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
  const [loadingTrackId, setLoadingTrackId] = useState(null);
  const [chosenQuery, setChosenQuery] = useState(null);
  const [activeQuery, setActiveQuery] = useState('latest songs');

  const sound = useRef(null);
  const loadedTrackId = useRef(null);
  const pausedTrackId = useRef(null);
  const playRequestId = useRef(0);
  const playTimer = useRef(null);
  const requestId = useRef(0);
  const mounted = useRef(true);
  const lastQuery = useRef('latest songs');
  const itemsRef = useRef(items);
  const recoveryTrackId = useRef(null);
  const verifiedTrackId = useRef(null);

  itemsRef.current = items;

  const clearPlayTimer = () => {
    if (playTimer.current) {
      clearTimeout(playTimer.current);
      playTimer.current = null;
    }
  };

  const stop = async () => {
    playRequestId.current += 1;
    clearPlayTimer();

    const current = sound.current;
    sound.current = null;
    loadedTrackId.current = null;
    pausedTrackId.current = null;
    verifiedTrackId.current = null;

    if (current) {
      try {
        current.setOnPlaybackStatusUpdate(null);
        await current.stopAsync().catch(() => {});
        await current.unloadAsync().catch(() => {});
      } catch {}
    }

    if (mounted.current) {
      setPlayingId(null);
      setLoadingTrackId(null);
    }
  };

  const pause = async () => {
    const current = sound.current;

    if (!current) {
      if (mounted.current) setPlayingId(null);
      return;
    }

    try {
      await current.pauseAsync();
      pausedTrackId.current = loadedTrackId.current;
    } catch {}

    if (mounted.current) setPlayingId(null);
  };

  const patchTrack = (id, patch) => {
    if (!mounted.current || !id || !patch) return;

    setItems((list) =>
      list.map((item) =>
        item.id === id ? { ...item, ...patch } : item
      )
    );
    setChosen((current) =>
      current?.id === id ? { ...current, ...patch } : current
    );
  };

  // Stream URLs can expire. Ask the backend for a fresh one before retrying.
  const refreshPreview = async (track, options = {}) => {
    if (!track?.id) return track;

    const query =
      track.searchQuery ||
      lastQuery.current ||
      [track.name || track.title, track.artist].filter(Boolean).join(' ');

    try {
      const fresh = await getTrackPreview(track.id, query, {
        timeoutMs: options.timeoutMs || 8000,
        forceRefresh: !!options.force,
      });
      const freshValues = Object.fromEntries(
        Object.entries(fresh).filter(
          ([, value]) => value !== '' && value != null
        )
      );
      const updated = { ...track, ...freshValues };

      patchTrack(track.id, freshValues);

      return updated;
    } catch {
      return track;
    }
  };

  const isRestricted = (track) =>
    !!(
      track?.disabled ||
      track?.rightsReason ||
      track?.isDrm
    );

  const restrictionMessage = (track) =>
    track?.disabledText ||
    track?.rightsReason ||
    'This track is restricted by the music provider.';

  const trackSourceLabel = (track) => {
    const source = String(track?.source || '').trim();
    const provider = source
      ? source.charAt(0).toUpperCase() + source.slice(1)
      : 'Music';

    const restriction =
      track?.disabledText ||
      track?.rightsReason ||
      (track?.disabled ? 'Unavailable' : '');

    const unavailable =
      !!restriction ||
      track?.isDrm ||
      track?.playbackType === 'unavailable' ||
      track?.playable === false ||
      !track?.url;

    if (unavailable) {
      return `${provider} · ${restriction || 'Unavailable'}`;
    }

    if (track?.playbackType === 'preview' || track?.isPreview) {
      return `${provider} · Preview only`;
    }

    if (track?.playbackType === 'full' || track?.isFullTrack) {
      return `${provider} · Full track`;
    }

    return `${provider} · Audio stream`;
  };

  const trackSourceColor = (track) => {
    if (track?.playbackType === 'preview' || track?.isPreview) {
      return '#F5C66A';
    }

    if (
      track?.playbackType === 'unavailable' ||
      track?.playable === false ||
      !track?.url
    ) {
      return '#FF9999';
    }

    return '#8BD5A7';
  };

  const recoverExpiredStream = async (
    track,
    from = 0,
    options = {}
  ) => {
    if (!track?.id || recoveryTrackId.current === track.id) {
      return false;
    }

    recoveryTrackId.current = track.id;

    const fresh = await refreshPreview(track, { force: true });
    const freshUrl = fresh?.streamUrl || fresh?.url;
    const oldUrl = track.streamUrl || track.url;
    const sameUrl = !freshUrl || freshUrl === oldUrl;

    if ((sameUrl && !options.retrySameUrl) || !mounted.current) {
      return false;
    }

    await preview(fresh, from, false);

    return true;
  };

  const prefetchNextStream = (track) => {
    const list = itemsRef.current;
    const index = list.findIndex((item) => item.id === track.id);
    const next = index >= 0 ? list[index + 1] : null;

    if (!next?.id || next.url || next.streamUrl) return;

    getTrackPreview(
      next.id,
      next.searchQuery || lastQuery.current,
      { timeoutMs: 8000 }
    )
      .then((fresh) => {
        if (!mounted.current) return;

        const values = Object.fromEntries(
          Object.entries(fresh).filter(
            ([, value]) => value !== '' && value != null
          )
        );

        patchTrack(next.id, values);
      })
      .catch(() => {});
  };

  const preview = async (track, from = 0, retry = true) => {
    if (!track) return;

    const startAt = Math.max(0, Math.floor(Number(from) || 0));

    if (!track?.url && retry) {
      track = await refreshPreview(track);
    }

    if (isRestricted(track)) {
      if (mounted.current) {
        setPlayingId(null);
        setLoadingTrackId(null);
        setError(restrictionMessage(track));
      }
      return;
    }

    if (!track?.url) {
      if (mounted.current) {
        setLoadingTrackId(null);
        setError('No playable audio is available for this song.');
      }
      return;
    }

    const current = sound.current;
    if (
      current &&
      loadedTrackId.current === track.id &&
      pausedTrackId.current === track.id
    ) {
      try {
        await current.playAsync();
        pausedTrackId.current = null;
        if (mounted.current) {
          setPlayingId(track.id);
          setError('');
        }
        return;
      } catch {
        // Fall through and reload the stream from the requested position.
      }
    }

    await stop();

    const token = playRequestId.current;
    const candidates = [
      ...new Set(
        [
          track.streamUrl,
          track.url,
          track.previewFallbackUrl,
        ].filter(Boolean)
      ),
    ];

    if (mounted.current) {
      setLoadingTrackId(track.id);
      setPlayingId(null);
      setError('');
    }

    clearPlayTimer();
    playTimer.current = setTimeout(() => {
      if (token !== playRequestId.current) return;

      playRequestId.current += 1;
      clearPlayTimer();

      if (mounted.current) {
        setLoadingTrackId(null);
        setPlayingId(null);
        setError('Playback took too long to start. Retrying…');
      }

      recoverExpiredStream(track, startAt, {
        retrySameUrl: true,
      }).catch(() => {});
    }, 15000);

    await ensureAudioMode();

    let lastError = null;

    for (const uri of candidates) {
      try {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri },
          {
            shouldPlay: true,
            positionMillis: startAt * 1000,
            volume: 1,
          }
        );

        if (!mounted.current || token !== playRequestId.current) {
          await newSound.unloadAsync().catch(() => {});
          return;
        }

        clearPlayTimer();
        sound.current = newSound;
        loadedTrackId.current = track.id;
        pausedTrackId.current = null;

        if (mounted.current) {
          setPlayingId(track.id);
          setLoadingTrackId(null);
          setError('');
        }

        prefetchNextStream(track);

        newSound.setOnPlaybackStatusUpdate((status) => {
          if (token !== playRequestId.current) return;

          if (!status.isLoaded) {
            if (status.error) {
              const position = Math.floor(
                (Number(status.positionMillis) || 0) / 1000
              );

              newSound.unloadAsync().catch(() => {});
              if (sound.current === newSound) sound.current = null;
              loadedTrackId.current = null;
              pausedTrackId.current = null;

              if (mounted.current) {
                setError('Refreshing this song’s stream…');
                setPlayingId(null);
                setLoadingTrackId(null);
              }

              recoverExpiredStream(
                track,
                position || startAt,
                { retrySameUrl: true }
              ).catch(() => {});
            }
            return;
          }

          if (
            status.durationMillis &&
            verifiedTrackId.current !== track.id
          ) {
            verifiedTrackId.current = track.id;

            const patch = getPlaybackVerification(
              track,
              status.durationMillis / 1000
            );

            if (patch) patchTrack(track.id, patch);
          }

          if (status.isBuffering) {
            if (mounted.current) setLoadingTrackId(track.id);

            if (!playTimer.current) {
              playTimer.current = setTimeout(() => {
                if (token !== playRequestId.current) return;

                const position = Math.floor(
                  (Number(status.positionMillis) || 0) / 1000
                );

                playRequestId.current += 1;
                clearPlayTimer();
                newSound.unloadAsync().catch(() => {});
                if (sound.current === newSound) sound.current = null;
                loadedTrackId.current = null;
                pausedTrackId.current = null;

                if (mounted.current) {
                  setPlayingId(null);
                  setLoadingTrackId(null);
                  setError('Playback stalled. Reconnecting…');
                }

                recoverExpiredStream(
                  track,
                  position || startAt,
                  { retrySameUrl: true }
                ).catch(() => {});
              }, 15000);
            }
          } else {
            clearPlayTimer();
            if (mounted.current) setLoadingTrackId(null);
          }

          if (status.didJustFinish) {
            clearPlayTimer();
            newSound.unloadAsync().catch(() => {});
            if (sound.current === newSound) sound.current = null;
            loadedTrackId.current = null;
            pausedTrackId.current = null;
            if (mounted.current) {
              setPlayingId(null);
              setLoadingTrackId(null);
            }
          }
        });

        return;
      } catch (e) {
        lastError = e;
      }
    }

    clearPlayTimer();

    if (!mounted.current || token !== playRequestId.current) return;

    if (retry) {
      const fresh = await refreshPreview(track, {
        force: true,
      });
      const freshCandidates = [
        ...new Set(
          [
            fresh?.streamUrl,
            fresh?.url,
            fresh?.previewFallbackUrl,
          ].filter(Boolean)
        ),
      ];
      const changed = freshCandidates.some(
        (url) => !candidates.includes(url)
      );

      if (changed) {
        if (mounted.current) setError('');
        await preview(fresh, startAt, false);
        return;
      }
    }

    if (mounted.current) {
      setPlayingId(null);
      setLoadingTrackId(null);
      setError(
        toErrorMessage(
          lastError,
          'Could not play this song. The stream may have expired.'
        )
      );
    }
  };

  // Stop playback when the picker closes or unmounts.
  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      playRequestId.current += 1;
      clearPlayTimer();

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

    const activeCat = CATEGORIES.find((c) => c.id === selectedCategory);
    const queryToSearch = q.trim() || activeCat?.query || 'latest songs';
    const cachedResults = getCachedSearch(queryToSearch, {
      allowStale: true,
    });

    setError('');

    if (cachedResults) {
      lastQuery.current = queryToSearch;
      setActiveQuery(queryToSearch);
      setItems(cachedResults);
      setLoading(false);
    } else {
      setLoading(true);
    }

    const timer = setTimeout(async () => {
      try {
        const results = await searchMusic(queryToSearch, {
          ...(controller ? { signal: controller.signal } : {}),
          onRevalidate: (freshResults) => {
            if (cancelled || thisRequest !== requestId.current) return;

            lastQuery.current = queryToSearch;
            setActiveQuery(queryToSearch);
            setItems(freshResults);
          },
        });

        if (cancelled || thisRequest !== requestId.current) return;

        lastQuery.current = queryToSearch;
        setActiveQuery(queryToSearch);
        setItems(results);
        setError('');
      } catch (e) {
        if (
          cancelled ||
          thisRequest !== requestId.current ||
          isAbortError(e)
        ) {
          return;
        }

        if (!cachedResults) setItems([]);
        setError(toErrorMessage(e, 'Could not load music.'));
      } finally {
        if (!cancelled && thisRequest === requestId.current) {
          setLoading(false);
        }
      }
    }, q.trim() ? 250 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller?.abort();
    };
  }, [q, selectedCategory, reloadKey]);

  const choose = async (track) => {
    recoveryTrackId.current = null;
    setChosen(track);
    setChosenQuery(track?.searchQuery || activeQuery);
    setStart(0);
    setError('');
    await preview(track, 0);
  };

  const togglePreview = async (track) => {
    if (playingId === track.id) {
      await pause();
      return;
    }

    if (loadingTrackId === track.id) {
      await stop();
      return;
    }

    recoveryTrackId.current = null;
    setChosen(track);
    setChosenQuery(track?.searchQuery || activeQuery);
    setStart(0);
    setError('');
    await preview(track, 0);
  };

  const useSong = async () => {
    if (!chosen) return;

    const track = chosen.url ? chosen : await refreshPreview(chosen);

    if (isRestricted(track) || !isTrackPlayable(track)) {
      setError(
        isRestricted(track)
          ? restrictionMessage(track)
          : track?.playbackMessage || 'This song does not have playable audio.'
      );
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

      {!!error && items.length > 0 && (
        <Text
          style={{
            color: '#FF9999',
            fontSize: 12,
            lineHeight: 17,
            marginHorizontal: 16,
            marginBottom: 8,
          }}
        >
          {error}
        </Text>
      )}

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
            const selected =
              chosen?.id === item.id && chosenQuery === activeQuery;
            const isPlaying = playingId === item.id;
            const isBuffering = loadingTrackId === item.id;
            const hasPreview = !!item.url && isTrackPlayable(item);

            return (
              <Pressable
                onPress={() => {
                  if (hasPreview) choose(item);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 9,
                  opacity: hasPreview ? 1 : 0.55,
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
                    {item.duration ? ` · ${mmss(item.duration)}` : ''}
                    {!hasPreview ? ' · Unavailable' : ''}
                  </Text>

                  <Text
                    numberOfLines={1}
                    style={{
                      color: trackSourceColor(item),
                      fontSize: 10,
                      marginTop: 3,
                    }}
                  >
                    {trackSourceLabel(item)}
                  </Text>
                </View>

                <Pressable
                  onPress={(event) => {
                    event?.stopPropagation?.();
                    togglePreview(item);
                  }}
                  disabled={!hasPreview}
                  hitSlop={8}
                  style={{ padding: 4, minWidth: 37, alignItems: 'center' }}
                >
                  {isBuffering ? (
                    <ActivityIndicator color={RED} size="small" />
                  ) : (
                    <Ionicons
                      name={isPlaying ? 'pause-circle' : 'play-circle-outline'}
                      size={29}
                      color={isPlaying ? RED : hasPreview ? '#CCCCCC' : '#555555'}
                    />
                  )}
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
                {chosen.artist} · {trackSourceLabel(chosen)}
              </Text>
            </View>

            <Pressable onPress={() => togglePreview(chosen)} hitSlop={8}>
              {loadingTrackId === chosen.id ? (
                <ActivityIndicator color={RED} />
              ) : (
                <Ionicons
                  name={playingId === chosen.id ? 'pause-circle' : 'play-circle'}
                  size={32}
                  color={RED}
                />
              )}
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
