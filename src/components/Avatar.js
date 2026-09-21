import React from 'react';
import { Image, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/SettingsContext';
import { gradientProps } from '../theme';
import { initials } from '../utils/helpers';
import T from './T';

const RING = 3;
const GAP = 3;

/**
 * ring: undefined (no ring) | 'active' (green-blue story ring) | 'seen' (grey ring) | 'none' (keeps the space)
 */
export default function Avatar({ uri, name, size = 48, online, ring }) {
  const { colors, gradient } = useTheme();

  const inner = (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} />
      ) : (
        <LinearGradient
          colors={gradient}
          {...gradientProps}
          style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
        >
          <T weight="semibold" size={size * 0.38} color="#fff">
            {initials(name)}
          </T>
        </LinearGradient>
      )}
    </View>
  );

  let body = inner;
  if (ring) {
    const outer = size + 2 * (RING + GAP);
    const ringColors = ring === 'active' ? gradient : ring === 'seen' ? [colors.border, colors.border] : ['transparent', 'transparent'];
    body = (
      <LinearGradient
        colors={ringColors}
        {...gradientProps}
        style={{ width: outer, height: outer, borderRadius: outer / 2, padding: RING }}
      >
        <View style={{ flex: 1, borderRadius: outer / 2, padding: GAP, backgroundColor: colors.bg }}>{inner}</View>
      </LinearGradient>
    );
  }

  return (
    <View>
      {body}
      {online ? (
        <View
          style={{
            position: 'absolute', right: ring ? RING + GAP - 1 : 0, bottom: ring ? RING + GAP - 1 : 0,
            width: size * 0.26, height: size * 0.26, borderRadius: size, backgroundColor: colors.online,
            borderWidth: 2, borderColor: colors.bg,
          }}
        />
      ) : null}
    </View>
  );
}
