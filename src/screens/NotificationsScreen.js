import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import { useTheme } from '../context/SettingsContext';
import { acceptRequest, declineRequest } from '../services/friends';
import { clearAllNotifications, markAllRead } from '../services/notifications';
import { timeAgo } from '../utils/helpers';
import { gradientProps } from '../theme';
import Screen from '../components/Screen';
import Avatar from '../components/Avatar';
import Btn from '../components/Btn';
import EmptyState from '../components/EmptyState';
import T from '../components/T';

const ICONS = {
  request: 'person-add',
  accepted: 'checkmark-circle',
  login: 'log-in',
  logout: 'log-out',
};

export default function NotificationsScreen({ navigation }) {
  const { me } = useAuth();
  const { notifications, incoming } = useAppData();
  const { colors, gradient } = useTheme();
  const [busyId, setBusyId] = useState(null);

  // mark as read shortly after the screen is opened
  useFocusEffect(
    useCallback(() => {
      const t = setTimeout(() => markAllRead(me.id, notifications).catch(() => {}), 1200);
      return () => clearTimeout(t);
    }, [notifications, me.id])
  );

  const act = async (id, fn) => {
    setBusyId(id);
    try {
      await fn();
    } catch (e) {
      Alert.alert('Something went wrong', e.message);
    } finally {
      setBusyId(null);
    }
  };

  const clearAll = () =>
    Alert.alert('Clear all notifications?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => clearAllNotifications(me.id, notifications).catch(() => {}) },
    ]);

  const renderItem = ({ item }) => {
    const req = item.type === 'request' ? incoming.find((r) => r.from === item.fromId) : null;
    return (
      <Pressable
        onPress={() => item.fromId && navigation.navigate('UserProfile', { userId: item.fromId })}
        style={{
          flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 12,
          backgroundColor: item.read ? 'transparent' : colors.inputBg,
        }}
      >
        {item.fromId ? (
          <Avatar uri={item.fromPhoto} name={item.fromName} size={46} />
        ) : (
          <LinearGradient
            colors={gradient} {...gradientProps}
            style={{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name={ICONS[item.type] || 'notifications'} size={22} color="#fff" />
          </LinearGradient>
        )}
        <View style={{ flex: 1 }}>
          <T size={14}>{item.text}</T>
          <T size={11} color="subtext" style={{ marginTop: 2 }}>{timeAgo(item.createdAt)}</T>
          {req ? (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <Btn small label="Accept" loading={busyId === item.id} onPress={() => act(item.id, () => acceptRequest(me, req))} />
              <Btn small variant="soft" label="Decline" disabled={busyId === item.id} onPress={() => act(item.id, () => declineRequest(req))} />
            </View>
          ) : null}
        </View>
        {!item.read ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.accent, marginTop: 6 }} /> : null}
      </Pressable>
    );
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 }}>
        <T weight="bold" size={24} style={{ flex: 1 }}>Notifications</T>
        {notifications.length ? (
          <Pressable onPress={clearAll} hitSlop={10}>
            <T color="primary" weight="medium">Clear all</T>
          </Pressable>
        ) : null}
      </View>
      <FlatList
        data={notifications}
        keyExtractor={(n) => n.id}
        renderItem={renderItem}
        ListEmptyComponent={
          <EmptyState icon="notifications-outline" title="All caught up" text="Friend requests and account activity will show up here." />
        }
      />
    </Screen>
  );
}
