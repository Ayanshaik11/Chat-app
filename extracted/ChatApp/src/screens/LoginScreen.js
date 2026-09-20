import React, { useState } from "react";
import { Alert, Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import Btn from "../components/Btn";
import { errorMessage, isCancelled, loginWithGoogle } from "../lib/auth";
import { feedback } from "../lib/feedback";
import { fonts, gradients, palettes, radius } from "../theme";

// Shown before login, so it uses the dark palette directly (no context yet)
const colors = palettes.dark;

export default function LoginScreen() {
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    try {
      const ok = await loginWithGoogle();
      if (ok) feedback.success();
    } catch (error) {
      if (!isCancelled(error)) {
        feedback.error();
        Alert.alert("Couldn't sign in", errorMessage(error));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.glow} />

      <View style={styles.center}>
        <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logo}>
          <Ionicons name="chatbubbles" size={42} color="#03231f" />
        </LinearGradient>

        <Text style={styles.title}>Chat</Text>
        <Text style={styles.tagline}>Stories, posts and messages{"\n"}with the people you know.</Text>
      </View>

      <View style={styles.bottom}>
        <Btn
          label={busy ? "Signing in..." : "Continue with Google"}
          onPress={signIn}
          busy={busy}
          icon={<Ionicons name="logo-google" size={17} color={colors.primaryText} />}
        />
        <Text style={styles.small}>
          Your Google account is your account here. Nothing is posted to Google.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 26, justifyContent: "space-between" },
  glow: { position: "absolute", top: -170, right: -120, width: 340, height: 340, borderRadius: 170, opacity: 0.22 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  logo: {
    width: 92,
    height: 92,
    borderRadius: radius.lg + 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22
  },
  title: { color: colors.text, fontFamily: fonts.displayBold, fontSize: 38, letterSpacing: -0.5 },
  tagline: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 14.5,
    textAlign: "center",
    marginTop: 10,
    lineHeight: 21
  },
  bottom: { paddingBottom: 46 },
  small: { color: colors.faint, fontFamily: fonts.body, fontSize: 11.5, textAlign: "center", marginTop: 14 }
});
