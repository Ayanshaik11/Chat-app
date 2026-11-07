import React from 'react';
import { Image, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/SettingsContext';
import { gradientProps } from '../theme';

// Round group picture: the group's photo, or a people icon on the app gradient.
export default function GroupAvatar({ uri, size = 48 }) {
  const { gradient } = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} />
      ) : (
        <LinearGradient colors={gradient} {...gradientProps} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="people" size={size * 0.5} color="#fff" />
        </LinearGradient>
      )}
    </View>
  );
}
