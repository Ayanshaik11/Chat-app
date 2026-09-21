import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/SettingsContext';
import T from './T';
import Btn from './Btn';

export default function EmptyState({ icon = 'sparkles-outline', title, text, actionLabel, onAction }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', padding: 32, gap: 8 }}>
      <View
        style={{
          width: 72, height: 72, borderRadius: 36, backgroundColor: colors.inputBg,
          alignItems: 'center', justifyContent: 'center', marginBottom: 6,
        }}
      >
        <Ionicons name={icon} size={32} color={colors.primary} />
      </View>
      <T weight="semibold" size={17}>{title}</T>
      {text ? <T color="subtext" style={{ textAlign: 'center' }}>{text}</T> : null}
      {actionLabel ? <Btn label={actionLabel} onPress={onAction} small style={{ marginTop: 10 }} /> : null}
    </View>
  );
}
