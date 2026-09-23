import React from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/SettingsContext';
import { gradientProps } from '../theme';
import T from './T';

// A calm, in-app card (not a system alert) — slides up like a normal app
// notice. Update happens without ever leaving the app.
export default function UpdateCard({ state }) {
  const { colors, gradient } = useTheme();
  const { info, visible, downloading, progress, error, install, dismiss } = state;
  if (!visible) return null;

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 14, right: 14, bottom: 14 }}>
      <View
        style={{
          backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 14,
          shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <LinearGradient colors={gradient} {...gradientProps} style={{ width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="sparkles" size={20} color="#fff" />
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <T weight="semibold" size={14}>New version {info.latestVersion}</T>
            <T size={12} color="subtext" numberOfLines={2}>{info.notes || 'A new version of Chat App is ready.'}</T>
          </View>
          {!info.forced ? (
            <Pressable onPress={dismiss} hitSlop={10}>
              <Ionicons name="close" size={18} color={colors.subtext} />
            </Pressable>
          ) : null}
        </View>

        {error ? (
          <View style={{ marginTop: 8 }}>
            <T size={12} color="danger">{error}</T>
            <Pressable onPress={() => Linking.openURL(info.url).catch(() => {})} style={{ marginTop: 4 }}>
              <T size={12} color="primary" weight="medium">Or open the download link in your browser</T>
            </Pressable>
          </View>
        ) : null}

        <View style={{ marginTop: 12 }}>
          {downloading ? (
            <View style={{ height: 40, borderRadius: 20, backgroundColor: colors.inputBg, overflow: 'hidden', justifyContent: 'center' }}>
              <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.max(6, progress * 100)}%`, backgroundColor: colors.primary }} />
              <T weight="semibold" size={13} style={{ textAlign: 'center' }}>{`Installing… ${Math.round(progress * 100)}%`}</T>
            </View>
          ) : (
            <Pressable onPress={install}>
              <LinearGradient colors={gradient} {...gradientProps} style={{ height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
                <T weight="semibold" size={14} color="#fff">
                  {error ? 'Try again' : Platform.OS === 'android' ? 'Update now' : 'Download update'}
                </T>
              </LinearGradient>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}
