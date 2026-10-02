import React from 'react';
import {
  ActivityIndicator,
  Text,
  View,
} from 'react-native';

import {
  NavigationContainer,
} from '@react-navigation/native';

import {
  createNativeStackNavigator,
} from '@react-navigation/native-stack';

import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../context/AuthContext';

import { navigationRef } from './navigationRef';

const Stack = createNativeStackNavigator();

function TestScreen() {
  return (
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
          color: '#FFFFFF',
          marginTop: 12,
          fontSize: 17,
        }}
      >
        Stack test
      </Text>

      <Text
        style={{
          color: '#777777',
          marginTop: 8,
          fontSize: 13,
        }}
      >
        No HomeScreen • No Tabs
      </Text>
    </View>
  );
}

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
          color="#FFFFFF"
          size="large"
        />

        <Text
          style={{
            color: '#FFFFFF',
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
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen
          name="Main"
          component={TestScreen}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}