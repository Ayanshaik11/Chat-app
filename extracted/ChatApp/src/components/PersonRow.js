import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import Avatar from "./Avatar";
import Btn from "./Btn";
import { useColors } from "../lib/AppContext";
import { fonts } from "../theme";

export default function PersonRow({ person, subtitle, action, onPress }) {
  const colors = useColors();

  return (
    <Pressable style={[styles.row, { borderBottomColor: colors.border }]} onPress={onPress}>
      <Avatar user={person} size={48} />

      <View style={{ flex: 1, marginHorizontal: 12 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontFamily: fonts.bodySemi, fontSize: 15 }}>
          {person.name}
        </Text>
        <Text numberOfLines={1} style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 12.5, marginTop: 2 }}>
          {subtitle || person.email}
        </Text>
      </View>

      {action}
    </Pressable>
  );
}

export function RowAction({ label, onPress, variant = "primary", busy }) {
  return <Btn small label={label} onPress={onPress} variant={variant} busy={busy} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth
  }
});
