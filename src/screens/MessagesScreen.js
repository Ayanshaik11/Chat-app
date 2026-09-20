import React, { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import Avatar from "../components/Avatar";
import { Empty, Header } from "../components/Screen";
import { useApp, useColors } from "../lib/AppContext";
import { getProfile, watchChats } from "../lib/data";
import { fonts } from "../theme";
import { timeAgo } from "../lib/utils";

export default function MessagesScreen({ navigation }) {
  const colors = useColors();
  const { profile } = useApp();

  const [chats, setChats] = useState([]);
  const [friends, setFriends] = useState([]);

  useEffect(() => watchChats(profile.uid, setChats), [profile.uid]);

  // Friends you haven't messaged yet still show, so you can start a chat
  useEffect(() => {
    const ids = profile.friends || [];
    Promise.all(ids.map(getProfile))
      .then((list) => setFriends(list.filter(Boolean)))
      .catch(console.error);
  }, [(profile.friends || []).join(",")]);

  const rows = useMemo(() => {
    const talked = new Set();

    const fromChats = chats.map((chat) => {
      const otherId = (chat.members || []).find((id) => id !== profile.uid);
      talked.add(otherId);
      return {
        key: chat.id,
        person: { id: otherId, name: chat.names?.[otherId] || "Someone", photo: chat.photos?.[otherId] || "" },
        preview: chat.lastMessage || "Say hello",
        when: timeAgo(chat.updatedAt),
        unreadish: chat.lastSender && chat.lastSender !== profile.uid
      };
    });

    const rest = friends
      .filter((friend) => !talked.has(friend.id))
      .map((friend) => ({ key: `new-${friend.id}`, person: friend, preview: "Say hello", when: "", unreadish: false }));

    return [...fromChats, ...rest];
  }, [chats, friends, profile.uid]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Messages" subtitle={`${rows.length} conversation${rows.length === 1 ? "" : "s"}`} />

      <FlatList
        data={rows}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.row, { borderBottomColor: colors.border }]}
            onPress={() => navigation.navigate("Chat", { person: item.person })}
          >
            <Avatar user={item.person} size={52} />

            <View style={{ flex: 1, marginHorizontal: 12 }}>
              <Text numberOfLines={1} style={{ color: colors.text, fontFamily: fonts.bodySemi, fontSize: 15 }}>
                {item.person.name}
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  color: item.unreadish ? colors.text : colors.muted,
                  fontFamily: item.unreadish ? fonts.bodyMedium : fonts.body,
                  fontSize: 13,
                  marginTop: 3
                }}
              >
                {item.preview}
              </Text>
            </View>

            <Text style={{ color: colors.faint, fontFamily: fonts.body, fontSize: 11 }}>{item.when}</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <Empty
            icon="chatbubble-ellipses-outline"
            title="No conversations yet"
            note="Add a friend in the Discover tab, then tap them to start chatting."
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth
  }
});
