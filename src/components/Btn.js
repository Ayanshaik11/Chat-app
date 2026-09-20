import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { useColors } from "../lib/AppContext";
import { feedback } from "../lib/feedback";
import { fonts, gradients, radius } from "../theme";

export default function Btn({
  label,
  onPress,
  variant = "primary", // primary | soft | ghost | danger
  busy = false,
  disabled = false,
  small = false,
  icon = null,
  style
}) {
  const colors = useColors();
  const off = disabled || busy;

  function handlePress() {
    if (off) return;
    feedback.tap();
    onPress?.();
  }

  const height = small ? 38 : 50;
  const textSize = small ? 13 : 15;

  const body = (
    <View style={styles.row}>
      {busy ? (
        <ActivityIndicator color={variant === "primary" ? colors.primaryText : colors.primary} />
      ) : (
        <>
          {icon}
          <Text
            style={{
              color:
                variant === "primary"
                  ? colors.primaryText
                  : variant === "danger"
                    ? colors.danger
                    : colors.text,
              fontFamily: fonts.bodySemi,
              fontSize: textSize,
              marginLeft: icon ? 8 : 0
            }}
          >
            {label}
          </Text>
        </>
      )}
    </View>
  );

  if (variant === "primary") {
    return (
      <Pressable onPress={handlePress} style={[{ opacity: off ? 0.55 : 1 }, style]}>
        <LinearGradient
          colors={gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.base, { height, borderRadius: radius.pill }]}
        >
          {body}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      style={[
        styles.base,
        {
          height,
          borderRadius: radius.pill,
          opacity: off ? 0.55 : 1,
          backgroundColor: variant === "ghost" ? "transparent" : colors.surfaceAlt,
          borderWidth: variant === "ghost" ? 1 : 0,
          borderColor: colors.border
        },
        style
      ]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center" }
});
