import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import {
  NavigationContainer,
} from '@react-navigation/native';

import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../context/AuthContext';

import { navigationRef } from './navigationRef';

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
          }}
        >
          Loading King X...
        </Text>
      </LinearGradient>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <View
        style={{
          flex: 1,
          backgroundColor: '#0A0A0A',
          alignItems: 'center',
          justifyContent: 'center',
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
          }}
        >
          NavigationContainer test
        </Text>
      </View>
    </NavigationContainer>
  );
}