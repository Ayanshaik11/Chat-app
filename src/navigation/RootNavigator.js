import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import {
  NavigationContainer,
} from '@react-navigation/native';

import {
  createNativeStackNavigator,
} from '@react-navigation/native-stack';

import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../context/AuthContext';

import HomeScreen from '../screens/HomeScreen';

import { navigationRef } from './navigationRef';

const Stack = createNativeStackNavigator();

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
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        {fbUser ? (
          <Stack.Screen
            name="Main"
            component={HomeScreen}
          />
        ) : (
          <Stack.Screen
            name="Login"
            component={View}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}