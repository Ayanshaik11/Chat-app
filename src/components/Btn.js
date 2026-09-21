import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/SettingsContext';
import { gradientProps } from '../theme';
import T from './T';

// variant: 'solid' (green-blue gradient) | 'soft' | 'danger'
export default function Btn({ label, icon, onPress, loading, disabled, variant = 'solid', small, style }) {
  const { colors, gradient } = useTheme();
  const height = small ? 34 : 46;
  const fg = variant === 'solid' ? '#fff' : variant === 'danger' ? colors.danger : colors.text;

  const content = loading ? (
    <ActivityIndicator color={fg} />
  ) : (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      {icon ? <Ionicons name={icon} size={small ? 16 : 19} color={fg} /> : null}
      <T weight="semibold" size={small ? 13 : 15} color={fg}>
        {label}
      </T>
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [{ opacity: disabled ? 0.5 : pressed ? 0.8 : 1 }, style]}
    >
      {variant === 'solid' ? (
        <LinearGradient
          colors={gradient}
          {...gradientProps}
          style={{ height, borderRadius: height / 2, paddingHorizontal: small ? 14 : 20, justifyContent: 'center' }}
        >
          {content}
        </LinearGradient>
      ) : (
        <View
          style={{
            height, borderRadius: height / 2, paddingHorizontal: small ? 14 : 20, justifyContent: 'center',
            backgroundColor: colors.card, borderWidth: 1, borderColor: variant === 'danger' ? colors.danger : colors.border,
          }}
        >
          {content}
        </View>
      )}
    </Pressable>
  );
}
