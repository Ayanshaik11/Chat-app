import React, { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Avatar from "../components/Avatar";
import Btn from "../components/Btn";
import Field from "../components/Field";
import { Header } from "../components/Screen";
import { useApp, useColors } from "../lib/AppContext";
import { updateProfile } from "../lib/data";
import { pickImage, uploadMedia } from "../lib/media";
import { feedback } from "../lib/feedback";
import { fonts } from "../theme";

export default function EditProfileScreen({ navigation }) {
  const colors = useColors();
  const { profile } = useApp();

  const [name, setName] = useState(profile.name || "");
  const [username, setUsername] = useState(profile.username || "");
  const [about, setAbout] = useState(profile.about || "");
  const [photo, setPhoto] = useState(profile.photo || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function changePhoto() {
    const picked = await pickImage({ square: true });
    if (!picked) return;

    setUploading(true);
    try {
      const url = await uploadMedia(picked.uri, `avatars/${profile.uid}/${Date.now()}`);
      setPhoto(url);
      feedback.success();
    } catch (error) {
      console.error(error);
      feedback.error();
      Alert.alert("Couldn't upload photo", "Check your connection and Storage rules.");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    const cleanName = name.trim();
    if (!cleanName) {
      feedback.error();
      Alert.alert("Enter your name");
      return;
    }

    let handle = username.trim().toLowerCase().replace(/[^a-z0-9._@]/g, "");
    if (handle && !handle.startsWith("@")) handle = "@" + handle;

    setSaving(true);
    try {
      await updateProfile(profile.uid, {
        name: cleanName,
        username: handle || profile.username,
        about: about.trim(),
        photo
      });
      feedback.success();
      navigation.goBack();
    } catch (error) {
      console.error(error);
      feedback.error();
      Alert.alert("Couldn't save", "Check your connection.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Edit profile" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Pressable style={styles.photo} onPress={changePhoto}>
          <Avatar user={{ ...profile, photo }} size={104} ring />
          <View style={[styles.badge, { backgroundColor: colors.primary, borderColor: colors.bg }]}>
            <Ionicons name={uploading ? "hourglass-outline" : "camera"} size={15} color={colors.primaryText} />
          </View>
        </Pressable>

        <Text style={[styles.hint, { color: colors.muted }]}>
          {uploading ? "Uploading..." : "Tap the picture to change it"}
        </Text>

        <Field label="Name" value={name} onChangeText={setName} placeholder="Your name" maxLength={40} />
        <Field
          label="Username"
          value={username}
          onChangeText={setUsername}
          placeholder="@yourname"
          autoCapitalize="none"
          maxLength={24}
        />
        <Field
          label="About"
          value={about}
          onChangeText={setAbout}
          placeholder="A line about you"
          multiline
          maxLength={160}
          hint={`${about.length}/160`}
        />

        <Field label="Email (from Google, can't change)" value={profile.email} editable={false} />

        <Btn label="Save changes" onPress={save} busy={saving} disabled={uploading} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  photo: { alignSelf: "center" },
  badge: {
    position: "absolute",
    right: 0,
    bottom: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center"
  },
  hint: { fontFamily: fonts.body, fontSize: 12, textAlign: "center", marginTop: 10, marginBottom: 22 }
});
