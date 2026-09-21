import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/SettingsContext';
import T from './T';

export default function ScreenHeader({ title, onBack, right, children }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 56,
        borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.bg,
      }}
    >
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={12} style={{ padding: 6 }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1, marginLeft: onBack ? 4 : 6 }}>
        {children || (
          <T weight="semibold" size={18} numberOfLines={1}>
            {title}
          </T>
        )}
      </View>
      {right}
    </View>
  );
}
