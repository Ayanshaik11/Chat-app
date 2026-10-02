import React from 'react';
import {
  ActivityIndicator,
  Text,
  View,
} from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../context/AuthContext';

export default function RootNavigator() {
  const { fbUser, me, initializing } = useAuth();

  if (initializing || (fbUser && !me)) {
    return (
      <LinearGradient
        colors={['#050505', '#1a0505', '#E11D2A']}
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator
          color="#fff"
          size="large"
        />

        <Text
          style={{
            color: '#fff',
            marginTop: 15,
            fontSize: 16,
          }}
        >
          Loading King X...
        </Text>
      </LinearGradient>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#0A0A0A',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <Text
        style={{
          color: '#E11D2A',
          fontSize: 32,
          fontWeight: '800',
        }}
      >
        KING X
      </Text>

      <Text
        style={{
          color: '#fff',
          marginTop: 12,
          fontSize: 16,
          textAlign: 'center',
        }}
      >
        Navigation diagnostic test
      </Text>

      <Text
        style={{
          color: '#888',
          marginTop: 8,
          fontSize: 13,
          textAlign: 'center',
        }}
      >
        Bottom tabs and React Navigation are completely disabled.
      </Text>
    </View>
  );
}