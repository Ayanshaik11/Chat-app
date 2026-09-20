import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { useColors } from "../lib/AppContext";
import { fonts, radius } from "../theme";

export default function Field({ label, hint, style, multiline = false, ...props }) {
  const colors = useColors();

  return (
    <View style={[{ marginBottom: 16 }, style]}>
      {label ? (
        <Text style={{ color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 12, marginBottom: 7 }}>
          {label}
        </Text>
      ) : null}

      <TextInput
        placeholderTextColor={colors.faint}
        multiline={multiline}
        style={[
          styles.input,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            color: colors.text,
            height: multiline ? 104 : 50,
            textAlignVertical: multiline ? "top" : "center"
          }
        ]}
        {...props}
      />

      {hint ? (
        <Text style={{ color: colors.faint, fontFamily: fonts.body, fontSize: 11, marginTop: 6 }}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.body,
    fontSize: 15
  }
});
