import { useEffect, useRef, useState } from 'react';
import { Audio } from 'expo-av';

// Plays a story/reel song while `play` is true. Loops from the chosen start time.
export function useMusic(music, play, muted = false, onError) {
  const fail = useRef(onError); fail.current = onError;
  const playRef = useRef(play); playRef.current = play;
  const sound = useRef(null);
  const [ready, setReady] = useState(false);
  const url = music?.url || music?.previewUrl;
  const start = (music?.start || 0) * 1000;

  useEffect(() => {
    if (!url) {
      setReady(false);
      return undefined;
    }

    let alive = true;
    let loaded = null;
    setReady(false);

    (async () => {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound: s } = await Audio.Sound.createAsync(
        { uri: url },
        { positionMillis: start, shouldPlay: false }
      );

      if (!alive) {
        await s.unloadAsync().catch(() => {});
        return;
      }

      s.setOnPlaybackStatusUpdate((st) => {
        if (!st.isLoaded) {
          if (st.error) fail.current?.(st.error);
          return;
        }

        if (st.didJustFinish) {
          const restart = s.setPositionAsync(start);
          if (playRef.current) {
            restart.then(() => s.playAsync()).catch(() => {});
          } else {
            restart.catch(() => {});
          }
        }
      });

      loaded = s;
      sound.current = s;
      setReady(true);
    })().catch((e) => {
      if (!alive) return;
      setReady(false);
      fail.current?.(e);
    });

    return () => {
      alive = false;
      if (sound.current === loaded) sound.current = null;
      setReady(false);
      loaded?.setOnPlaybackStatusUpdate?.(null);
      loaded?.unloadAsync().catch(() => {});
    };
  }, [url, start]);

  useEffect(() => {
    const s = sound.current;
    if (!s || !ready) return;

    s.setIsMutedAsync(!!muted).catch(() => {});
    (play && !muted ? s.playAsync() : s.pauseAsync()).catch((e) =>
      fail.current?.(e)
    );
  }, [ready, play, muted]);
}
