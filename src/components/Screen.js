import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/SettingsContext';

export default function Screen({ children, edges = ['top'], style }) {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: colors.bg }, style]}>
      {children}
    </SafeAreaView>
  );
}
