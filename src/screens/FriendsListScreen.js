import { FlatList, Pressable, View } from 'react-native';
import { useAppData } from '../context/AppDataContext';
import { isOnline } from '../utils/helpers';
import Screen from '../components/Screen';
import ScreenHeader from '../components/ScreenHeader';
import Avatar from '../components/Avatar';
import EmptyState from '../components/EmptyState';
import T from '../components/T';

export default function FriendsListScreen({ navigation }) {
  const { friends = [] } = useAppData();

  return (
    <Screen>
      <ScreenHeader
        title={`Friends (${friends.length})`}
        onBack={() => navigation.goBack()}
      />

      <FlatList
        data={friends}
        keyExtractor={(item) => item.id || item.uid}
        renderItem={({ item }) => {
          const id = item.id || item.uid;
          const name = item.name || item.displayName || 'User';
          const username = item.username || '';
          const photo =
            item.photoURL ||
            item.photoUrl ||
            item.profilePic ||
            item.avatar ||
            '';

          return (
            <Pressable
              onPress={() =>
                navigation.navigate('UserProfile', { userId: id })
              }
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 10,
                gap: 12,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Avatar
                uri={photo}
                name={name}
                size={50}
                online={isOnline(item)}
              />

              <View style={{ flex: 1, minWidth: 0 }}>
                <T weight="semibold" numberOfLines={1}>
                  {name}
                </T>

                {username ? (
                  <T size={12} color="subtext" numberOfLines={1}>
                    @{username}
                  </T>
                ) : null}
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title="No friends yet"
            text="People you add will show up here."
          />
        }
      />
    </Screen>
  );
}