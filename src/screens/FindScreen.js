import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import { useTheme } from '../context/SettingsContext';
import { newestUsers, searchUsersByEmail } from '../services/users';
import Screen from '../components/Screen';
import Avatar from '../components/Avatar';
import RelationButton from '../components/RelationButton';
import EmptyState from '../components/EmptyState';
import T from '../components/T';

export default function FindScreen({ navigation }) {
  const { me } = useAuth();
  const { relationTo } = useAppData();
  const { colors, fonts } = useTheme();
  const [text, setText] = useState('');
  const [results, setResults] = useState([]);
  const [suggested, setSuggested] = useState([]);
  const [loading, setLoading] = useState(false);
  const searching = text.trim().length >= 3;

  useEffect(() => {
    newestUsers(me.id).then(setSuggested).catch(() => {});
  }, [me.id]);

  // debounce the search
  useEffect(() => {
    if (!searching) {
      setResults([]);
      return undefined;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        setResults(await searchUsersByEmail(text, me.id));
      } catch (e) {
        console.warn('search failed', e);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [text, searching, me.id]);

  const data = searching ? results : suggested.filter((u) => relationTo(u.id) !== 'friend');

  const row = ({ item }) => (
    <Pressable
      onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12 }}
    >
      <Avatar uri={item.photoURL} name={item.name} size={50} />
      <View style={{ flex: 1 }}>
        <T weight="semibold" numberOfLines={1}>{item.name}</T>
        <T size={12} color="subtext" numberOfLines={1}>{item.email}</T>
      </View>
      <RelationButton user={item} />
    </Pressable>
  );

  return (
    <Screen>
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 }}>
        <T weight="bold" size={24}>Find people</T>
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', backgroundColor: colors.inputBg, borderRadius: 14,
            paddingHorizontal: 12, marginTop: 12, height: 46, gap: 8,
          }}
        >
          <Ionicons name="mail-outline" size={20} color={colors.subtext} />
          <TextInput
            value={text} onChangeText={setText} placeholder="Search by Gmail, e.g. name@gmail.com"
            placeholderTextColor={colors.subtext} autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
            style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.text }}
          />
          {text ? (
            <Pressable onPress={() => setText('')} hitSlop={8}>
              <Ionicons name="close-circle" size={20} color={colors.subtext} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <FlatList
        data={data}
        keyExtractor={(u) => u.id}
        renderItem={row}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          !searching && data.length ? (
            <T weight="semibold" size={15} style={{ paddingHorizontal: 16, paddingVertical: 8 }}>New on Chat App</T>
          ) : null
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          ) : searching ? (
            <EmptyState icon="search-outline" title="No one found" text="Check the Gmail address. The person must have signed in to Chat App once." />
          ) : (
            <EmptyState icon="people-outline" title="Find your friends" text="Type at least 3 letters of their Gmail address to search." />
          )
        }
      />
    </Screen>
  );
}
