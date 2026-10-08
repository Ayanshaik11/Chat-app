import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

const MAX_SECONDS = 180;

const fmt = (sec) => {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * Replaces the chat composer while a voice message is being recorded.
 * Starts recording immediately. Trash = cancel, send button = finish & send.
 */
export default function VoiceRecorderBar({ onCancel, onSend }) {
  const recordingRef = useRef(null);
  const finishedRef = useRef(false);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const permission = await Audio.requestPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Microphone needed', 'Please allow microphone access in your phone settings to send voice messages.');
          onCancel?.();
          return;
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const recording = new Audio.Recording();
        await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        recording.setOnRecordingStatusUpdate((status) => {
          if (alive && status.isRecording) {
            setSeconds((status.durationMillis || 0) / 1000);
          }
        });
        recording.setProgressUpdateInterval(250);

        if (!alive) {
          await recording.stopAndUnloadAsync().catch(() => {});
          return;
        }

        await recording.startAsync();
        recordingRef.current = recording;
        setStarted(true);
      } catch (error) {
        Alert.alert('Recording failed', error?.message || 'Could not start recording.');
        onCancel?.();
      }
    })();

    return () => {
      alive = false;
      const rec = recordingRef.current;
      if (rec && !finishedRef.current) {
        rec.stopAndUnloadAsync().catch(() => {});
      }
      Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
    };
  }, []);

  const finish = async (shouldSend) => {
    const rec = recordingRef.current;
    if (!rec || finishedRef.current) {
      onCancel?.();
      return;
    }
    finishedRef.current = true;
    setBusy(true);

    try {
      const status = await rec.getStatusAsync();
      const duration = (status?.durationMillis || seconds * 1000) / 1000;
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});

      if (shouldSend && uri && duration >= 0.6) {
        await onSend?.(uri, duration);
      } else {
        onCancel?.();
      }
    } catch (error) {
      Alert.alert('Voice message failed', error?.message || 'Could not send the voice message.');
      onCancel?.();
    }
  };

  // auto-send at the time limit
  useEffect(() => {
    if (started && seconds >= MAX_SECONDS && !finishedRef.current) {
      finish(true);
    }
  }, [seconds, started]);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 8,
        backgroundColor: '#0D0D0D',
      }}
    >
      <Pressable
        onPress={() => finish(false)}
        disabled={busy}
        hitSlop={8}
        style={{ width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }}
      >
        <Ionicons name="trash-outline" size={24} color="#E11D2A" />
      </Pressable>

      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          height: 44,
          borderRadius: 22,
          backgroundColor: '#1A1A1A',
          paddingHorizontal: 16,
          marginHorizontal: 6,
        }}
      >
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: '#E11D2A',
            opacity: Math.floor(seconds * 2) % 2 === 0 ? 1 : 0.25,
          }}
        />
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 10 }}>
          {fmt(seconds)}
        </Text>
        <Text style={{ color: '#8F8F8F', fontSize: 13, marginLeft: 10 }}>
          {started ? 'Recording…' : 'Starting…'}
        </Text>
      </View>

      <Pressable
        onPress={() => finish(true)}
        disabled={busy || !started}
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: started ? '#E11D2A' : '#333',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="send" size={19} color="#fff" />}
      </Pressable>
    </View>
  );
}
