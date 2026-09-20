import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { useColors } from "../lib/AppContext";
import { fonts, gradients } from "../theme";
import { initials } from "../lib/utils";

export default function Avatar({ user, size = 44, ring = false, ringColors = gradients.story }) {
  const colors = useColors();
  const inner = ring ? size - 6 : size;

  const face = user?.photo ? (
    <Image source={{ uri: user.photo }} style={{ width: inner, height: inner, borderRadius: inner / 2 }} />
  ) : (
    <View
      style={[
        styles.fallback,
        { width: inner, height: inner, borderRadius: inner / 2, backgroundColor: colors.surfaceAlt }
      ]}
    >
      <Text style={{ color: colors.primary, fontFamily: fonts.displayBold, fontSize: inner * 0.36 }}>
        {initials(user?.name, user?.email)}
      </Text>
    </View>
  );

  if (!ring) return face;

  return (
    <LinearGradient
      colors={ringColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size / 2, padding: 2.5 }}
    >
      <View
        style={{
          flex: 1,
          borderRadius: size / 2,
          padding: 1.5,
          backgroundColor: colors.bg,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        {face}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: "center", justifyContent: "center" }
});
