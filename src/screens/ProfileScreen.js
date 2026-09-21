import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/SettingsContext';
import Screen from '../components/Screen';
import T from '../components/T';
import ProfileView from './ProfileView';

export default function ProfileScreen({ navigation }) {
  const { me } = useAuth();
  const { colors } = useTheme();
  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 56 }}>
        <T weight="bold" size={20} style={{ flex: 1 }} numberOfLines={1}>@{me.username}</T>
        <Pressable onPress={() => navigation.navigate('Create', { mode: 'post' })} hitSlop={10} style={{ marginRight: 18 }}>
          <Ionicons name="add-circle-outline" size={28} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Settings')} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <T weight="medium" size={14} color="primary">Settings</T>
          <Ionicons name="settings-outline" size={25} color={colors.text} />
        </Pressable>
      </View>
      <ProfileView userId={me.id} navigation={navigation} />
    </Screen>
  );
}
