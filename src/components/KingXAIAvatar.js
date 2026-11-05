import React from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/SettingsContext';
import { gradientProps } from '../theme';

// The King X AI "face": red -> black gradient with a sparkle
export default function KingXAIAvatar({ size = 40 }) {
  const { gradient } = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
      <LinearGradient colors={gradient} {...gradientProps} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="sparkles" size={size * 0.5} color="#fff" />
      </LinearGradient>
    </View>
  );
}
