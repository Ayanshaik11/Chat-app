import React from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/SettingsContext';
import T from '../components/T';

export default function LoginScreen() {
  const { signInWithGoogle, busy } = useAuth();
  const { fonts } = useTheme();

  const onPress = async () => {
    try {
      await signInWithGoogle();
    } catch (e) {
      Alert.alert('Google sign-in failed', e?.message || 'Please try again.');
    }
  };

  return (
    <LinearGradient colors={['#083B36', '#0E7C66', '#0EA5E9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, padding: 24, justifyContent: 'space-between' }}>
        <View style={{ alignItems: 'center', marginTop: 90 }}>
          <View
            style={{
              width: 92, height: 92, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.18)',
              alignItems: 'center', justifyContent: 'center', marginBottom: 18,
            }}
          >
            <Ionicons name="chatbubbles" size={46} color="#fff" />
          </View>
          <Text style={{ fontFamily: fonts.logo, fontSize: 46, color: '#fff', lineHeight: 70 }}>King X</Text>
          <T color="rgba(255,255,255,0.85)" size={15} style={{ textAlign: 'center', marginTop: 6 }}>
            Share moments, follow your friends{'\n'}and chat in real time.
          </T>
        </View>

        <View style={{ gap: 14 }}>
          <Pressable
            onPress={onPress}
            disabled={busy}
            style={({ pressed }) => ({
              height: 54, borderRadius: 27, backgroundColor: '#fff', flexDirection: 'row',
              alignItems: 'center', justifyContent: 'center', gap: 10, opacity: pressed ? 0.85 : 1,
            })}
          >
            {busy ? (
              <ActivityIndicator color="#0E7C66" />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color="#0E7C66" />
                <T weight="semibold" size={16} color="#083B36">Continue with Google</T>
              </>
            )}
          </Pressable>
          <T size={12} color="rgba(255,255,255,0.7)" style={{ textAlign: 'center' }}>
            Your Google account ID is used as your user ID.
          </T>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}
