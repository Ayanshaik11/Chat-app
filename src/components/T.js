import React from 'react';
import { Text } from 'react-native';
import { useTheme } from '../context/SettingsContext';

// Themed text with the app font. color: a theme key ('subtext', 'primary'...) or any color string
export default function T({ weight = 'regular', size = 14, color, style, children, ...rest }) {
  const { colors, fonts } = useTheme();
  return (
    <Text
      {...rest}
      style={[{ fontFamily: fonts[weight], fontSize: size, color: colors[color] || color || colors.text }, style]}
    >
      {children}
    </Text>
  );
}
