import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Dimensions, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { VideoView, useVideoPlayer } from "expo-video";

import Avatar from "../components/Avatar";
import { useApp } from "../lib/AppContext";
import { deleteStory } from "../lib/data";
import { feedback } from "../lib/feedback";
import { isLive, storyHoursLeft, timeAgo } from "../lib/utils";
import { fonts, palettes } from "../theme";

const { width, height } = Dimensions.get("window");
const PICTURE_MS = 5000;
const dark = palettes.dark; // the story viewer is always dark, like Instagram

export default function StoryScreen({ route, navigation }) {
  const { profile } = useApp();
  const insets = useSafeAreaInsets();

  const group = route.params.group;
  const items = useMemo(() => (group.items || []).filter(isLive).slice().reverse(), [group]);

  const [index, setIndex] = useState(0);
  const current = items[index];
  const timer = useRef(null);

  const player = useVideoPlayer(current?.type === "video" ? current.media : null, (instance) => {
    if (instance) instance.loop = false;
  });

  // Pictures move on by themselves; videos wait until they finish
  useEffect(() => {
    if (!current) {
      navigation.goBack();
      return undefined;
    }

    clearTimeout(timer.current);

    if (current.type === "video") {
      try {
        player.play();
      } catch (error) {
        // ignore
      }
      return undefined;
    }

    timer.current = setTimeout(next, PICTURE_MS);
    return () => clearTimeout(timer.current);
  }, [index, current?.id]);

  function next() {
    if (index + 1 < items.length) setIndex(index + 1);
    else navigation.goBack();
  }

  function previous() {
    if (index > 0) setIndex(index - 1);
    else navigation.goBack();
  }

  function confirmDelete() {
    Alert.alert("Delete story", "Remove this story now?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteStory(current.id);
          feedback.delete();
          next();
        }
      }
    ]);
  }

  if (!current) return <View style={styles.root} />;

  return (
    <View style={styles.root}>
      {current.type === "video" ? (
        <VideoView player={player} style={styles.media} contentFit="contain" nativeControls={false} />
      ) : (
        <Image source={{ uri: current.media }} style={styles.media} resizeMode="contain" />
      )}

      <View style={[styles.bars, { top: insets.top + 8 }]}>
        {items.map((item, position) => (
          <View
            key={item.id}
            style={[styles.bar, { backgroundColor: position <= index ? "#ffffff" : "rgba(255,255,255,0.3)" }]}
          />
        ))}
      </View>

      <View style={[styles.top, { top: insets.top + 20 }]}>
        <Avatar user={{ name: group.name, photo: group.photo }} size={34} />
        <View style={{ flex: 1, marginHorizontal: 10 }}>
          <Text style={styles.name}>{group.name}</Text>
          <Text style={styles.meta}>
            {timeAgo(current.createdAt)} · {storyHoursLeft(current)}h left
          </Text>
        </View>

        {current.uid === profile.uid ? (
          <Pressable hitSlop={10} onPress={confirmDelete} style={{ marginRight: 16 }}>
            <Ionicons name="trash-outline" size={20} color="#ffffff" />
          </Pressable>
        ) : null}

        <Pressable hitSlop={10} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={25} color="#ffffff" />
        </Pressable>
      </View>

      <Pressable style={[styles.tap, { left: 0 }]} onPress={previous} />
      <Pressable style={[styles.tap, { right: 0 }]} onPress={next} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },
  media: { width, height },
  bars: { position: "absolute", left: 10, right: 10, flexDirection: "row", gap: 4 },
  bar: { flex: 1, height: 2.5, borderRadius: 2 },
  top: { position: "absolute", left: 14, right: 14, flexDirection: "row", alignItems: "center" },
  name: { color: "#ffffff", fontFamily: fonts.bodySemi, fontSize: 14 },
  meta: { color: "rgba(255,255,255,0.65)", fontFamily: fonts.body, fontSize: 11, marginTop: 1 },
  tap: { position: "absolute", top: 90, bottom: 0, width: width * 0.4 }
});
