import React, { useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Btn from "../components/Btn";
import Field from "../components/Field";
import { Header } from "../components/Screen";
import { useApp, useColors } from "../lib/AppContext";
import { createPost } from "../lib/data";
import { pickImage, uploadMedia } from "../lib/media";
import { feedback } from "../lib/feedback";
import { fonts, radius } from "../theme";

// Posts are pictures only - videos belong in stories
export default function NewPostScreen({ navigation }) {
  const colors = useColors();
  const { profile } = useApp();

  const [image, setImage] = useState(null);
  const [caption, setCaption] = useState("");
  const [posting, setPosting] = useState(false);

  async function choose() {
    const picked = await pickImage({ square: true });
    if (picked) {
      setImage(picked.uri);
      feedback.tap();
    }
  }

  async function share() {
    if (!image) {
      feedback.error();
      Alert.alert("Pick a picture first");
      return;
    }

    setPosting(true);
    try {
      const url = await uploadMedia(image, `posts/${profile.uid}/${Date.now()}`);
      await createPost(profile, url, caption);
      feedback.success();
      navigation.goBack();
    } catch (error) {
      console.error(error);
      feedback.error();
      Alert.alert("Couldn't post", "Check your connection and Storage rules.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="New post" subtitle="Pictures only" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Pressable
          onPress={choose}
          style={[styles.picker, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          {image ? (
            <Image source={{ uri: image }} style={styles.preview} resizeMode="cover" />
          ) : (
            <View style={styles.pickerInner}>
              <Ionicons name="image-outline" size={34} color={colors.primary} />
              <Text style={{ color: colors.text, fontFamily: fonts.bodySemi, fontSize: 14, marginTop: 10 }}>
                Choose a picture
              </Text>
              <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 4 }}>
                Square crop, from your gallery
              </Text>
            </View>
          )}
        </Pressable>

        {image ? (
          <Pressable onPress={choose} style={{ alignSelf: "center", marginBottom: 18 }}>
            <Text style={{ color: colors.primary, fontFamily: fonts.bodyMedium, fontSize: 13 }}>
              Choose a different picture
            </Text>
          </Pressable>
        ) : null}

        <Field
          label="Caption"
          value={caption}
          onChangeText={setCaption}
          placeholder="Write something..."
          multiline
          maxLength={300}
        />

        <Btn label={posting ? "Posting..." : "Share post"} onPress={share} busy={posting} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  picker: {
    aspectRatio: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  pickerInner: { alignItems: "center" },
  preview: { width: "100%", height: "100%" }
});
