import React from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useAppData } from '../context/AppDataContext';
import { isOnline } from '../utils/helpers';
import Screen from '../components/Screen';
import ScreenHeader from '../components/ScreenHeader';
import Avatar from '../components/Avatar';
import EmptyState from '../components/EmptyState';
import T from '../components/T';

// Instagram-style friends list, opened by tapping the "Friends" count on my profile
export default function FriendsListScreen({ navigation }) {
  const { friends } = useAppData();

  return (
    <Screen>
      <ScreenHeader title={`Friends (${friends.length})`} onBack={() => navigation.goBack()} />
      <FlatList
        data={friends}
        keyExtractor={(f) => f.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12 }}
          >
            <Avatar uri={item.photoURL} name={item.name} size={50} online={isOnline(item)} />
            <View style={{ flex: 1 }}>
              <T weight="semibold" numberOfLines={1}>{item.name}</T>
              <T size={12} color="subtext" numberOfLines={1}>@{item.username}</T>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={<EmptyState icon="people-outline" title="No friends yet" text="People you add will show up here." />}
      />
    </Screen>
  );
}
