import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import HomeScreen from '../screens/HomeScreen';
import ReelsScreen from '../screens/ReelsScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,

        tabBarActiveTintColor: '#ffffff',
        tabBarInactiveTintColor: '#777777',

        tabBarStyle: {
          backgroundColor: '#0A0A0A',
          borderTopColor: '#222222',
        },

        tabBarIcon: ({ color, size }) => {
          let icon = 'ellipse-outline';

          if (route.name === 'Home') {
            icon = 'home-outline';
          } else if (route.name === 'Reels') {
            icon = 'videocam-outline';
          } else if (route.name === 'Profile') {
            icon = 'person-outline';
          }

          return (
            <Ionicons
              name={icon}
              size={size}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Home',
        }}
      />

      <Tab.Screen
        name="Reels"
        component={ReelsScreen}
        options={{
          title: 'Videos',
        }}
      />

      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
}