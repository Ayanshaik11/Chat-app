import React, { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Avatar from "../components/Avatar";
import Btn from "../components/Btn";
import { Header } from "../components/Screen";
import { useApp, useColors } from "../lib/AppContext";
import { logout } from "../lib/auth";
import { logActivity } from "../lib/data";
import { feedback } from "../lib/feedback";
import { fonts, radius } from "../theme";

const THEMES = [
  { key: "light", label: "Light", icon: "sunny-outline" },
  { key: "dark", label: "Dark", icon: "moon-outline" },
  { key: "system", label: "System", icon: "phone-portrait-outline" }
];

export default function SettingsScreen({ navigation }) {
  const colors = useColors();
  const { profile, themeChoice, setTheme, settings, setSetting } = useApp();
  const [leaving, setLeaving] = useState(false);

  function confirmLogout() {
    Alert.alert("Log out", "You'll need to sign in with Google again.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          setLeaving(true);
          try {
            await logActivity(profile, "logout");
            await logout();
            feedback.delete();
          } catch (error) {
            console.error(error);
            feedback.error();
            setLeaving(false);
          }
        }
      }
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Settings" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Pressable
          style={[styles.card, styles.me, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => navigation.navigate("EditProfile")}
        >
          <Avatar user={profile} size={52} />
          <View style={{ flex: 1, marginHorizontal: 12 }}>
            <Text style={{ color: colors.text, fontFamily: fonts.bodySemi, fontSize: 15 }}>{profile.name}</Text>
            <Text numberOfLines={1} style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 12.5 }}>
              {profile.email}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={19} color={colors.muted} />
        </Pressable>

        <Text style={[styles.section, { color: colors.muted }]}>Appearance</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, padding: 6 }]}>
          <View style={styles.themeRow}>
            {THEMES.map((option) => {
              const active = themeChoice === option.key;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => {
                    feedback.tap();
                    setTheme(option.key);
                  }}
                  style={[
                    styles.themeChip,
                    { backgroundColor: active ? colors.primary : "transparent" }
                  ]}
                >
                  <Ionicons
                    name={option.icon}
                    size={17}
                    color={active ? colors.primaryText : colors.muted}
                  />
                  <Text
                    style={{
                      color: active ? colors.primaryText : colors.muted,
                      fontFamily: fonts.bodyMedium,
                      fontSize: 13,
                      marginTop: 5
                    }}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Text style={[styles.section, { color: colors.muted }]}>Feedback</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Toggle
            icon="phone-portrait-outline"
            label="Vibration"
            note="Buzz on taps, sends and errors"
            value={settings.vibration}
            onChange={(on) => {
              setSetting("vibration", on);
              if (on) feedback.tap();
            }}
            colors={colors}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Toggle
            icon="volume-medium-outline"
            label="Sounds"
            note="Small sounds for actions"
            value={settings.sound}
            onChange={(on) => {
              setSetting("sound", on);
              if (on) feedback.tap();
            }}
            colors={colors}
          />
        </View>

        <Text style={[styles.section, { color: colors.muted }]}>Account</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Line
            icon="create-outline"
            label="Edit profile"
            onPress={() => navigation.navigate("EditProfile")}
            colors={colors}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Line
            icon="finger-print-outline"
            label="Your user id"
            value={profile.uid.slice(0, 10) + "..."}
            colors={colors}
          />
        </View>

        <Btn label="Log out" variant="danger" busy={leaving} onPress={confirmLogout} style={{ marginTop: 24 }} />

        <Text style={[styles.footer, { color: colors.faint }]}>Chat · com.chat.app · v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

function Toggle({ icon, label, note, value, onChange, colors }) {
  return (
    <View style={styles.line}>
      <Ionicons name={icon} size={19} color={colors.primary} />
      <View style={{ flex: 1, marginHorizontal: 12 }}>
        <Text style={{ color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 14.5 }}>{label}</Text>
        <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 11.5, marginTop: 2 }}>{note}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.primary, false: colors.surfaceAlt }}
        thumbColor="#ffffff"
      />
    </View>
  );
}

function Line({ icon, label, value, onPress, colors }) {
  return (
    <Pressable style={styles.line} onPress={onPress}>
      <Ionicons name={icon} size={19} color={colors.primary} />
      <Text style={{ flex: 1, color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 14.5, marginHorizontal: 12 }}>
        {label}
      </Text>
      {value ? (
        <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 12.5 }}>{value}</Text>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
  me: { flexDirection: "row", alignItems: "center", padding: 12 },
  section: { fontFamily: fonts.bodyMedium, fontSize: 12, marginTop: 22, marginBottom: 8, marginLeft: 4 },
  line: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 14 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 45 },
  themeRow: { flexDirection: "row", gap: 6 },
  themeChip: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: radius.sm },
  footer: { fontFamily: fonts.body, fontSize: 11.5, textAlign: "center", marginTop: 26 }
});
