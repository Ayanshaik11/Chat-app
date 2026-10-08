import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

const BAR_WIDTH = 130;

const fmt = (sec) => {
  const s = Math.max(0, Math.floor(sec || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// only one voice message plays at a time
let currentlyPlaying = null;

export default function VoiceMessageBubble({ url, duration = 0 }) {
  const soundRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [total, setTotal] = useState(duration || 0);

  const stopSelf = async () => {
    const sound = soundRef.current;
    if (sound) {
      await sound.pauseAsync().catch(() => {});
    }
    setPlaying(false);
  };

  useEffect(
    () => () => {
      const sound = soundRef.current;
      if (sound) {
        sound.unloadAsync().catch(() => {});
      }
      if (currentlyPlaying === stopSelf) {
        currentlyPlaying = null;
      }
    },
    []
  );

  const onStatus = (status) => {
    if (!status.isLoaded) {
      return;
    }
    setPosition((status.positionMillis || 0) / 1000);
    if (status.durationMillis) {
      setTotal(status.durationMillis / 1000);
    }
    if (status.didJustFinish) {
      setPlaying(false);
      setPosition(0);
      soundRef.current?.setPositionAsync(0).catch(() => {});
    }
  };

  const toggle = async () => {
    if (loading) {
      return;
    }

    try {
      if (playing) {
        await stopSelf();
        return;
      }

      if (currentlyPlaying && currentlyPlaying !== stopSelf) {
        await currentlyPlaying();
      }

      if (!soundRef.current) {
        setLoading(true);
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });
        const { sound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: false }, onStatus);
        soundRef.current = sound;
        setLoading(false);
      }

      currentlyPlaying = stopSelf;
      await soundRef.current.playAsync();
      setPlaying(true);
    } catch (error) {
      setLoading(false);
      setPlaying(false);
    }
  };

  const progress = total > 0 ? Math.min(1, position / total) : 0;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minWidth: 190 }}>
      <Pressable
        onPress={toggle}
        hitSlop={6}
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: 'rgba(255,255,255,0.22)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Ionicons name={playing ? 'pause' : 'play'} size={20} color="#fff" style={{ marginLeft: playing ? 0 : 2 }} />
        )}
      </Pressable>

      <View style={{ marginLeft: 10 }}>
        <View
          style={{
            width: BAR_WIDTH,
            height: 4,
            borderRadius: 2,
            backgroundColor: 'rgba(255,255,255,0.3)',
            overflow: 'hidden',
          }}
        >
          <View style={{ width: BAR_WIDTH * progress, height: 4, backgroundColor: '#fff' }} />
        </View>
        <Text style={{ color: '#fff', fontSize: 11, marginTop: 5, opacity: 0.85 }}>
          {playing || position > 0 ? fmt(position) : fmt(total)}
        </Text>
      </View>

      <Ionicons name="mic" size={16} color="rgba(255,255,255,0.7)" style={{ marginLeft: 10 }} />
    </View>
  );
}
