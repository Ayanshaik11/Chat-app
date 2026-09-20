import React, { useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Avatar from "../components/Avatar";
import Btn from "../components/Btn";
import { Empty, Header } from "../components/Screen";
import { useApp, useColors } from "../lib/AppContext";
import {
  acceptFriendRequest,
  clearNotifications,
  declineFriendRequest,
  markAllRead,
  watchIncomingRequests,
  watchNotifications
} from "../lib/data";
import { feedback } from "../lib/feedback";
import { fonts, radius } from "../theme";
import { timeAgo } from "../lib/utils";

const ICONS = {
  request: "person-add-outline",
  accepted: "checkmark-circle-outline",
  like: "heart-outline",
  login: "log-in-outline",
  logout: "log-out-outline"
};

export default function NotificationsScreen({ navigation }) {
  const colors = useColors();
  const { profile } = useApp();

  const [items, setItems] = useState([]);
  const [requests, setRequests] = useState([]);
  const [workingOn, setWorkingOn] = useState(null);

  useEffect(() => {
    const stopNotes = watchNotifications(profile.uid, setItems);
    const stopRequests = watchIncomingRequests(profile.uid, setRequests);
    return () => {
      stopNotes();
      stopRequests();
    };
  }, [profile.uid]);

  // Opening the tab marks everything as seen
  useEffect(() => {
    markAllRead(profile.uid).catch(() => {});
  }, [profile.uid, items.length]);

  const pending = useMemo(() => requests.filter((request) => request.status === "pending"), [requests]);

  async function respond(request, accept) {
    setWorkingOn(request.id);
    try {
      if (accept) {
        await acceptFriendRequest(profile, request);
        feedback.success();
      } else {
        await declineFriendRequest(request);
        feedback.delete();
      }
    } catch (error) {
      console.error(error);
      feedback.error();
    } finally {
      setWorkingOn(null);
    }
  }

  function clearAll() {
    Alert.alert("Clear notifications", "Remove everything from this list?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          await clearNotifications(profile.uid);
          feedback.delete();
        }
      }
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header
        title="Notifications"
        right={
          items.length ? (
            <Pressable hitSlop={10} onPress={clearAll}>
              <Ionicons name="trash-outline" size={20} color={colors.muted} />
            </Pressable>
          ) : null
        }
      />

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          pending.length ? (
            <View style={{ paddingTop: 12 }}>
              <Text style={[styles.section, { color: colors.muted }]}>Friend requests</Text>

              {pending.map((request) => (
                <View
                  key={request.id}
                  style={[styles.request, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <Avatar user={{ name: request.fromName, photo: request.fromPhoto }} size={44} />

                  <View style={{ flex: 1, marginHorizontal: 11 }}>
                    <Text numberOfLines={1} style={{ color: colors.text, fontFamily: fonts.bodySemi, fontSize: 14 }}>
                      {request.fromName}
                    </Text>
                    <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 11.5, marginTop: 2 }}>
                      wants to be your friend
                    </Text>
                  </View>

                  <Btn small label="Accept" busy={workingOn === request.id} onPress={() => respond(request, true)} />
                  <Btn
                    small
                    label="No"
                    variant="ghost"
                    style={{ marginLeft: 7 }}
                    onPress={() => respond(request, false)}
                  />
                </View>
              ))}

              <Text style={[styles.section, { color: colors.muted, marginTop: 14 }]}>Activity</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            style={[styles.row, { borderBottomColor: colors.border }]}
            onPress={() => item.from !== profile.uid && navigation.navigate("User", { uid: item.from })}
          >
            <View style={[styles.dot, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name={ICONS[item.type] || "notifications-outline"} size={17} color={colors.primary} />
            </View>

            <Text style={{ flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 14, marginHorizontal: 11 }}>
              {item.text}
            </Text>

            <Text style={{ color: colors.faint, fontFamily: fonts.body, fontSize: 11 }}>
              {timeAgo(item.createdAt)}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          pending.length ? null : (
            <Empty
              icon="notifications-outline"
              title="Nothing new"
              note="Friend requests, likes and sign-in activity will show up here."
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontFamily: fonts.bodyMedium, fontSize: 12, paddingHorizontal: 16, paddingBottom: 8 },
  request: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 14,
    marginBottom: 9,
    padding: 11,
    borderRadius: radius.md,
    borderWidth: 1
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  dot: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" }
});
