import React, { useEffect, useMemo, useState } from "react";
import { Alert, Dimensions, FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Avatar from "../components/Avatar";
import Btn from "../components/Btn";
import { Empty, Header } from "../components/Screen";
import { useApp, useColors } from "../lib/AppContext";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  getProfile,
  removeFriend,
  sendFriendRequest,
  watchIncomingRequests,
  watchOutgoingRequests,
  watchProfile,
  watchUserPosts
} from "../lib/data";
import { feedback } from "../lib/feedback";
import { fonts, radius } from "../theme";

const GAP = 2;
const TILE = (Dimensions.get("window").width - GAP * 2) / 3;

// Used for both "my profile" (tab) and someone else's profile (pushed screen)
export default function ProfileScreen({ navigation, route }) {
  const colors = useColors();
  const { profile } = useApp();

  const uid = route?.params?.uid || profile.uid;
  const isMe = uid === profile.uid;

  const [person, setPerson] = useState(isMe ? profile : null);
  const [posts, setPosts] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isMe) {
      setPerson(profile);
      return undefined;
    }
    return watchProfile(uid, setPerson);
  }, [uid, isMe, profile]);

  useEffect(() => watchUserPosts(uid, setPosts), [uid]);

  useEffect(() => {
    if (isMe) return undefined;
    const stopOut = watchOutgoingRequests(profile.uid, setOutgoing);
    const stopIn = watchIncomingRequests(profile.uid, setIncoming);
    return () => {
      stopOut();
      stopIn();
    };
  }, [profile.uid, isMe]);

  const friends = profile.friends || [];
  const isFriend = friends.includes(uid);
  const sent = useMemo(() => outgoing.some((request) => request.to === uid), [outgoing, uid]);
  const gotRequest = useMemo(() => incoming.find((request) => request.from === uid), [incoming, uid]);

  async function friendAction() {
    setBusy(true);
    try {
      if (isFriend) {
        await removeFriend(profile.uid, uid);
        feedback.delete();
      } else if (gotRequest) {
        await acceptFriendRequest(profile, gotRequest);
        feedback.success();
      } else if (sent) {
        await cancelFriendRequest(profile.uid, uid);
        feedback.delete();
      } else {
        await sendFriendRequest(profile, person);
        feedback.success();
      }
    } catch (error) {
      console.error(error);
      feedback.error();
      Alert.alert("Something went wrong", "Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  if (!person) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Header title="Profile" onBack={isMe ? undefined : () => navigation.goBack()} />
        <Empty icon="person-outline" title="Loading profile..." />
      </View>
    );
  }

  const friendLabel = isFriend ? "Friends" : gotRequest ? "Accept request" : sent ? "Requested" : "Add friend";

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header
        title={person.username || person.name}
        onBack={isMe ? undefined : () => navigation.goBack()}
        right={
          isMe ? (
            <Pressable hitSlop={10} onPress={() => navigation.navigate("Settings")}>
              <Ionicons name="settings-outline" size={22} color={colors.text} />
            </Pressable>
          ) : null
        }
      />

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        numColumns={3}
        columnWrapperStyle={{ gap: GAP }}
        contentContainerStyle={{ gap: GAP, paddingBottom: 30 }}
        ListHeaderComponent={
          <View style={{ padding: 18, paddingBottom: 14 }}>
            <View style={styles.top}>
              <Avatar user={person} size={86} ring />

              <View style={styles.stats}>
                <Stat value={posts.length} label="Posts" colors={colors} />
                <Stat value={(person.friends || []).length} label="Friends" colors={colors} />
              </View>
            </View>

            <Text style={{ color: colors.text, fontFamily: fonts.display, fontSize: 18, marginTop: 14 }}>
              {person.name}
            </Text>
            <Text style={{ color: colors.primary, fontFamily: fonts.bodyMedium, fontSize: 12.5, marginTop: 2 }}>
              {person.username}
            </Text>
            {person.about ? (
              <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 13.5, marginTop: 7, lineHeight: 19 }}>
                {person.about}
              </Text>
            ) : null}

            <View style={styles.buttons}>
              {isMe ? (
                <>
                  <Btn
                    small
                    label="Edit profile"
                    variant="soft"
                    style={{ flex: 1 }}
                    onPress={() => navigation.navigate("EditProfile")}
                  />
                  <Btn small label="New post" style={{ flex: 1 }} onPress={() => navigation.navigate("NewPost")} />
                </>
              ) : (
                <>
                  <Btn
                    small
                    label={friendLabel}
                    variant={isFriend || sent ? "ghost" : "primary"}
                    busy={busy}
                    style={{ flex: 1 }}
                    onPress={friendAction}
                  />
                  <Btn
                    small
                    label="Message"
                    variant="soft"
                    style={{ flex: 1 }}
                    onPress={() => navigation.navigate("Chat", { person })}
                  />
                </>
              )}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => navigation.navigate("Post", { post: item })}>
            <Image source={{ uri: item.image }} style={{ width: TILE, height: TILE }} />
          </Pressable>
        )}
        ListEmptyComponent={
          <Empty
            icon="camera-outline"
            title={isMe ? "No posts yet" : "Nothing posted yet"}
            note={isMe ? "Tap New post to share your first picture." : undefined}
          />
        }
      />
    </View>
  );
}

function Stat({ value, label, colors }) {
  return (
    <View style={{ alignItems: "center", marginLeft: 26 }}>
      <Text style={{ color: colors.text, fontFamily: fonts.displayBold, fontSize: 18 }}>{value}</Text>
      <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center" },
  stats: { flexDirection: "row", flex: 1, justifyContent: "flex-end" },
  buttons: { flexDirection: "row", gap: 9, marginTop: 16 }
});
