import React from 'react';
import { Image, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/SettingsContext';
import { gradientProps } from '../theme';

// Round group picture: the group's photo, or a people icon on the app gradient.
// A small "people" badge in the corner always marks it as a group, even when it has a photo.
export default function GroupAvatar({ uri, size = 48, badge = true }) {
  const { gradient, colors } = useTheme();
  const b = Math.max(16, Math.round(size * 0.38)); // badge diameter

  return (
    <View style={{ width: size, height: size }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
        {uri ? (
          <Image source={{ uri }} style={{ width: size, height: size }} />
        ) : (
          <LinearGradient colors={gradient} {...gradientProps} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="people" size={size * 0.5} color="#fff" />
          </LinearGradient>
        )}
      </View>
      {badge ? (
        <View
          style={{
            position: 'absolute', right: -2, bottom: -2, width: b, height: b, borderRadius: b / 2,
            backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.bg,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name="people" size={b * 0.55} color="#fff" />
        </View>
      ) : null}
    </View>
  );
}
