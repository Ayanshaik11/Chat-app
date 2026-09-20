import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useColors } from "../lib/AppContext";
import { feedback } from "../lib/feedback";
import { fonts, gradients } from "../theme";

export function Header({ title, subtitle, onBack, right = null, gradientTitle = false }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.header,
        { paddingTop: insets.top + 8, borderBottomColor: colors.border, backgroundColor: colors.bg }
      ]}
    >
      {onBack ? (
        <Pressable
          hitSlop={12}
          onPress={() => {
            feedback.tap();
            onBack();
          }}
          style={styles.back}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
      ) : null}

      <View style={{ flex: 1 }}>
        {gradientTitle ? (
          <MaskedTitle title={title} />
        ) : (
          <Text numberOfLines={1} style={{ color: colors.text, fontFamily: fonts.display, fontSize: 20 }}>
            {title}
          </Text>
        )}
        {subtitle ? (
          <Text numberOfLines={1} style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 12 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {right}
    </View>
  );
}

// The app name in the green -> blue brand gradient
function MaskedTitle({ title }) {
  return (
    <View style={{ flexDirection: "row" }}>
      <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.brandPill}>
        <Text style={{ color: "#03231f", fontFamily: fonts.displayBold, fontSize: 18 }}>{title}</Text>
      </LinearGradient>
    </View>
  );
}

export function Empty({ icon = "sparkles-outline", title, note }) {
  const colors = useColors();

  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceAlt }]}>
        <Ionicons name={icon} size={28} color={colors.primary} />
      </View>
      <Text style={{ color: colors.text, fontFamily: fonts.display, fontSize: 16, marginTop: 14 }}>{title}</Text>
      {note ? (
        <Text
          style={{
            color: colors.muted,
            fontFamily: fonts.body,
            fontSize: 13,
            marginTop: 6,
            textAlign: "center",
            maxWidth: 260
          }}
        >
          {note}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  back: { marginRight: 8, marginLeft: -6 },
  brandPill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 60, paddingHorizontal: 20 },
  emptyIcon: { width: 62, height: 62, borderRadius: 31, alignItems: "center", justifyContent: "center" }
});
