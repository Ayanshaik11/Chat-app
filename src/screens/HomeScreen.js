import React, { useEffect, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Empty, Header } from "../components/Screen";
import PostCard from "../components/PostCard";
import StoryBar from "../components/StoryBar";
import { useApp, useColors } from "../lib/AppContext";
import { createStory, watchFeed, watchStories } from "../lib/data";
import { pickStoryMedia, uploadMedia } from "../lib/media";
import { feedback } from "../lib/feedback";

export default function HomeScreen({ navigation }) {
  const colors = useColors();
  const { profile } = useApp();

  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const stopFeed = watchFeed(setPosts);
    const stopStories = watchStories(setStories);
    return () => {
      stopFeed();
      stopStories();
    };
  }, []);

  // A story lives for 24 hours, then disappears on its own
  async function addStory() {
    if (uploading) return;

    const picked = await pickStoryMedia();
    if (!picked) return;

    setUploading(true);
    try {
      const url = await uploadMedia(picked.uri, `stories/${profile.uid}/${Date.now()}`);
      await createStory(profile, url, picked.type);
      feedback.success();
    } catch (error) {
      console.error(error);
      feedback.error();
      Alert.alert("Couldn't add story", "Check your connection and Storage rules.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header
        title="Chat"
        gradientTitle
        right={
          <View style={styles.icons}>
            <Pressable hitSlop={10} onPress={() => navigation.navigate("NewPost")}>
              <Ionicons name="add-circle-outline" size={25} color={colors.text} />
            </Pressable>
            <Pressable hitSlop={10} onPress={() => navigation.navigate("Messages")}>
              <Ionicons name="paper-plane-outline" size={23} color={colors.text} />
            </Pressable>
          </View>
        }
      />

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 26 }}
        ListHeaderComponent={
          <StoryBar
            stories={stories}
            busy={uploading}
            onAdd={addStory}
            onOpen={(group) => navigation.navigate("Story", { group })}
          />
        }
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 12, paddingTop: 12 }}>
            <PostCard post={item} onOpenProfile={(uid) => navigation.navigate("User", { uid })} />
          </View>
        )}
        ListEmptyComponent={
          <Empty
            icon="images-outline"
            title="No posts yet"
            note="Add your first picture with the + button, or find people to follow in the Discover tab."
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  icons: { flexDirection: "row", alignItems: "center", gap: 16 }
});
