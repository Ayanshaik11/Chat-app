import { useEffect, useRef, useState } from 'react';
import { Audio } from 'expo-av';

// Plays a story/reel song while `play` is true. Loops from the chosen start time.
export function useMusic(music, play, muted = false, onError) {
  const fail = useRef(onError); fail.current = onError;
  const sound = useRef(null);
  const [ready, setReady] = useState(false);
  const url = music?.url;
  const start = (music?.start || 0) * 1000;

  useEffect(() => {
    if (!url) return undefined;
    let alive = true;
    let loaded = null;
    (async () => {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound: s } = await Audio.Sound.createAsync({ uri: url }, { positionMillis: start, shouldPlay: false });
      if (!alive) return s.unloadAsync();
      s.setOnPlaybackStatusUpdate((st) => { if (st.isLoaded && st.didJustFinish) s.setPositionAsync(start).then(() => s.playAsync()).catch(() => {}); });
      loaded = s;
      sound.current = s;
      setReady(true);
    })().catch((e) => { if (alive) fail.current?.(e); });
    return () => { alive = false; sound.current = null; setReady(false); loaded?.unloadAsync().catch(() => {}); };
  }, [url, start]);

  useEffect(() => {
    const s = sound.current;
    if (!s) return;
    s.setIsMutedAsync(!!muted).catch(() => {});
    (play && !muted ? s.playAsync() : s.pauseAsync()).catch((e) => fail.current?.(e));
  }, [ready, play, muted]);
}
