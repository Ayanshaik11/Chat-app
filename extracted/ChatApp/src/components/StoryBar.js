import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Avatar from "./Avatar";
import { useApp, useColors } from "../lib/AppContext";
import { feedback } from "../lib/feedback";
import { fonts } from "../theme";
import { isLive } from "../lib/utils";

// Instagram-style row: your own "add story" bubble first, then everyone else's
export default function StoryBar({ stories, onAdd, onOpen, busy }) {
  const colors = useColors();
  const { profile } = useApp();

  const groups = useMemo(() => {
    const live = (stories || []).filter(isLive);
    const byUser = new Map();

    live.forEach((story) => {
      const group = byUser.get(story.uid) || {
        uid: story.uid,
        name: story.uid === profile.uid ? "Your story" : story.authorName,
        photo: story.authorPhoto,
        items: []
      };
      group.items.push(story);
      byUser.set(story.uid, group);
    });

    const list = Array.from(byUser.values());
    list.sort((a, b) => (a.uid === profile.uid ? -1 : b.uid === profile.uid ? 1 : 0));
    return list;
  }, [stories, profile.uid]);

  const mine = groups.find((group) => group.uid === profile.uid);
  const others = groups.filter((group) => group.uid !== profile.uid);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}
    >
      <Pressable
        style={styles.item}
        onPress={() => {
          feedback.tap();
          if (mine) onOpen(mine);
          else onAdd();
        }}
        onLongPress={onAdd}
      >
        <View>
          <Avatar user={profile} size={68} ring={Boolean(mine)} />
          {/* The small + always adds a new story, even when you already have one */}
          <Pressable
            hitSlop={8}
            onPress={onAdd}
            style={[styles.plus, { backgroundColor: colors.primary, borderColor: colors.bg }]}
          >
            <Ionicons name={busy ? "hourglass-outline" : "add"} size={14} color={colors.primaryText} />
          </Pressable>
        </View>
        <Text numberOfLines={1} style={[styles.label, { color: colors.text }]}>
          Your story
        </Text>
      </Pressable>

      {others.map((group) => (
        <Pressable
          key={group.uid}
          style={styles.item}
          onPress={() => {
            feedback.tap();
            onOpen(group);
          }}
        >
          <Avatar user={group} size={68} ring />
          <Text numberOfLines={1} style={[styles.label, { color: colors.text }]}>
            {group.name}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 12, paddingVertical: 12, gap: 14 },
  item: { width: 74, alignItems: "center" },
  label: { fontFamily: fonts.body, fontSize: 11, marginTop: 6, maxWidth: 72 },
  plus: {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center"
  }
});
