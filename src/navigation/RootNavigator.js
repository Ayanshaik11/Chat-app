import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import {
  NavigationContainer,
  DarkTheme,
  DefaultTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import { useTheme } from '../context/SettingsContext';

import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import FindScreen from '../screens/FindScreen';
import MessagesScreen from '../screens/MessagesScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import FriendsListScreen from '../screens/FriendsListScreen';
import ChatScreen from '../screens/ChatScreen';
import PostDetailScreen from '../screens/PostDetailScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import CreateScreen from '../screens/CreateScreen';
import StoryViewerScreen from '../screens/StoryViewerScreen';
import ReelsScreen from '../screens/ReelsScreen';

import { navigationRef } from './navigationRef';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Home: ['home', 'home-outline'],
  Find: ['search', 'search-outline'],
  Reels: ['film', 'film-outline'],
  Messages: ['chatbubbles', 'chatbubbles-outline'],
  Notifications: ['notifications', 'notifications-outline'],
  Profile: ['person', 'person-outline'],
};

function Tabs() {
  const { colors, fonts } = useTheme();
  const { unreadNotifs, unreadMessages } = useAppData();

  // IMPORTANT: screenOptions and each screen's options must stay referentially
  // stable across renders. A brand-new function/object on every render makes
  // React Navigation think the options changed every time, which triggers an
  // internal state update, which re-renders this component, which creates new
  // literals again — an infinite loop that crashes with "Maximum call stack
  // size exceeded". Only rebuild these when the values they depend on change.
  const screenOptions = useCallback(
    ({ route }) => {
      const icons = TAB_ICONS[route.name];
      return {
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.subtext,
        tabBarStyle: route.name === 'Reels' ? { display: 'none' } : { backgroundColor: colors.tabBar, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 10 },
        tabBarBadgeStyle: { backgroundColor: colors.accent, color: '#fff', fontFamily: fonts.semibold, fontSize: 10 },
        tabBarIcon: ({ color, focused }) => <Ionicons name={icons[focused ? 0 : 1]} size={24} color={color} />,
      };
    },
    [colors, fonts]
  );

  const messagesOptions = useMemo(
    () => ({ tabBarBadge: unreadMessages > 0 ? unreadMessages : undefined }),
    [unreadMessages]
  );
  const notificationsOptions = useMemo(
    () => ({ tabBarBadge: unreadNotifs > 0 ? unreadNotifs : undefined }),
    [unreadNotifs]
  );

  return (
    <Tab.Navigator screenOptions={screenOptions}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Find" component={FindScreen} />
      <Tab.Screen name="Reels" component={ReelsScreen} />
      <Tab.Screen name="Messages" component={MessagesScreen} options={messagesOptions} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} options={notificationsOptions} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const {
    fbUser,
    me,
    initializing,
  } = useAuth();

  const {
    colors,
    isDark,
  } = useTheme();

  if (
    initializing ||
    (fbUser && !me)
  ) {
    return (
      <LinearGradient
        colors={[
          '#050505',
          '#1a0505',
          '#E11D2A',
        ]}
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
            <Stack.Screen
              name="Main"
              component={Tabs}
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