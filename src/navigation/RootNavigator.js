import React from 'react';
import { ActivityIndicator } from 'react-native';

import {
  NavigationContainer,
  DarkTheme,
  DefaultTheme,
} from '@react-navigation/native';

import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/SettingsContext';

import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';

import ChatScreen from '../screens/ChatScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import FriendsListScreen from '../screens/FriendsListScreen';
import PostDetailScreen from '../screens/PostDetailScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import CreateScreen from '../screens/CreateScreen';
import StoryViewerScreen from '../screens/StoryViewerScreen';

import { navigationRef } from './navigationRef';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { fbUser, me, initializing } = useAuth();
  const { colors, isDark } = useTheme();

  // Firebase/auth is still initializing
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
      </LinearGradient>
    );
  }

  const baseTheme = isDark
    ? DarkTheme
    : DefaultTheme;

  const navTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: colors.primary,
      background: colors.bg,
      card: colors.card,
      text: colors.text,
      border: colors.border,
      notification: colors.accent,
    },
  };

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navTheme}
    >
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        {fbUser ? (
          <>
            {/* TEMPORARY TEST:
                Home is opened directly.
                BottomTabNavigator is completely removed.
            */}
            <Stack.Screen
              name="Main"
              component={HomeScreen}
            />

            <Stack.Screen
              name="Chat"
              component={ChatScreen}
            />

            <Stack.Screen
              name="UserProfile"
              component={UserProfileScreen}
            />

            <Stack.Screen
              name="FriendsList"
              component={FriendsListScreen}
            />

            <Stack.Screen
              name="PostDetail"
              component={PostDetailScreen}
            />

            <Stack.Screen
              name="EditProfile"
              component={EditProfileScreen}
            />

            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
            />

            <Stack.Screen
              name="Create"
              component={CreateScreen}
            />

            <Stack.Screen
              name="StoryViewer"
              component={StoryViewerScreen}
              options={{
                presentation: 'fullScreenModal',
                animation: 'fade',
              }}
            />
          </>
        ) : (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}