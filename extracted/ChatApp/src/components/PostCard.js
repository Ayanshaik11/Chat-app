import React from "react";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Avatar from "./Avatar";
import { useApp, useColors } from "../lib/AppContext";
import { feedback } from "../lib/feedback";
import { deletePost, toggleLike } from "../lib/data";
import { fonts, radius } from "../theme";
import { timeAgo } from "../lib/utils";

export default function PostCard({ post, onOpenProfile }) {
  const colors = useColors();
  const { profile } = useApp();

  const likes = post.likes || [];
  const liked = likes.includes(profile.uid);
  const mine = post.uid === profile.uid;

  async function like() {
    feedback.tap();
    try {
      await toggleLike(post, profile);
    } catch (error) {
      console.error(error);
    }
  }

  function confirmDelete() {
    Alert.alert("Delete post", "This post will be removed for everyone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deletePost(post.id);
            feedback.delete();
          } catch (error) {
            feedback.error();
            Alert.alert("Could not delete", "Check your connection.");
          }
        }
      }
    ]);
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Pressable style={styles.top} onPress={() => onOpenProfile?.(post.uid)}>
        <Avatar user={{ name: post.authorName, photo: post.authorPhoto }} size={38} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={{ color: colors.text, fontFamily: fonts.bodySemi, fontSize: 14 }} numberOfLines={1}>
            {post.authorName}
          </Text>
          <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 11 }}>
            {timeAgo(post.createdAt)}
          </Text>
        </View>

        {mine ? (
          <Pressable hitSlop={10} onPress={confirmDelete}>
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.muted} />
          </Pressable>
        ) : null}
      </Pressable>

      <Pressable onPress={like}>
        <Image source={{ uri: post.image }} style={styles.image} resizeMode="cover" />
      </Pressable>

      <View style={styles.actions}>
        <Pressable onPress={like} hitSlop={8} style={styles.action}>
          <Ionicons
            name={liked ? "heart" : "heart-outline"}
            size={23}
            color={liked ? colors.danger : colors.text}
          />
          <Text style={{ color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 13, marginLeft: 6 }}>
            {likes.length}
          </Text>
        </Pressable>
      </View>

      {post.caption ? (
        <Text style={{ color: colors.text, fontFamily: fonts.body, fontSize: 14, paddingHorizontal: 14, paddingBottom: 14 }}>
          <Text style={{ fontFamily: fonts.bodySemi }}>{post.authorName} </Text>
          {post.caption}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, overflow: "hidden", marginBottom: 16 },
  top: { flexDirection: "row", alignItems: "center", padding: 12 },
  image: { width: "100%", aspectRatio: 1 },
  actions: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 11 },
  action: { flexDirection: "row", alignItems: "center", marginRight: 18 }
});
