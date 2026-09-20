import React from "react";
import { ScrollView, View } from "react-native";

import PostCard from "../components/PostCard";
import { Header } from "../components/Screen";
import { useColors } from "../lib/AppContext";

export default function PostScreen({ route, navigation }) {
  const colors = useColors();
  const post = route.params.post;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Post" subtitle={post.authorName} onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={{ padding: 12 }}>
        <PostCard post={post} onOpenProfile={(uid) => navigation.navigate("User", { uid })} />
      </ScrollView>
    </View>
  );
}
