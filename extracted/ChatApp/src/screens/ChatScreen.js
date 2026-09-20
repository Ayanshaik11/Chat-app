import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import Avatar from "../components/Avatar";
import { Header } from "../components/Screen";
import { useApp, useColors } from "../lib/AppContext";
import { openChat, sendMessage, watchMessages } from "../lib/data";
import { feedback } from "../lib/feedback";
import { clockTime } from "../lib/utils";
import { fonts, radius } from "../theme";

export default function ChatScreen({ route, navigation }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useApp();
  const person = route.params.person;

  const [chatId, setChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    let stop;
    openChat(profile, person)
      .then((id) => {
        setChatId(id);
        stop = watchMessages(id, setMessages);
      })
      .catch(console.error);

    return () => stop?.();
  }, [person.id, profile.uid]);

  async function send() {
    const body = text.trim();
    if (!body || !chatId) return;

    setText("");
    setSending(true);
    try {
      await sendMessage(chatId, profile, person, body);
      feedback.message();
    } catch (error) {
      console.error(error);
      feedback.error();
      setText(body);
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Header
        title={person.name}
        subtitle={person.email}
        onBack={() => navigation.goBack()}
        right={<Avatar user={person} size={34} />}
      />

      {chatId ? (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 14, paddingBottom: 18 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => {
            const mine = item.from === profile.uid;
            return (
              <View style={[styles.bubbleRow, { justifyContent: mine ? "flex-end" : "flex-start" }]}>
                <View
                  style={[
                    styles.bubble,
                    {
                      backgroundColor: mine ? colors.bubbleMine : colors.bubbleTheirs,
                      borderBottomRightRadius: mine ? 5 : radius.lg,
                      borderBottomLeftRadius: mine ? radius.lg : 5
                    }
                  ]}
                >
                  <Text style={{ color: mine ? "#ffffff" : colors.text, fontFamily: fonts.body, fontSize: 14.5 }}>
                    {item.text}
                  </Text>
                  <Text
                    style={{
                      color: mine ? "rgba(255,255,255,0.7)" : colors.faint,
                      fontFamily: fonts.body,
                      fontSize: 10,
                      marginTop: 4,
                      alignSelf: "flex-end"
                    }}
                  >
                    {clockTime(item.createdAt)}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      ) : (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}

      <View
        style={[
          styles.composer,
          { borderTopColor: colors.border, backgroundColor: colors.bg, paddingBottom: insets.bottom + 10 }
        ]}
      >
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Message..."
          placeholderTextColor={colors.faint}
          multiline
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
        />
        <Pressable
          onPress={send}
          disabled={!text.trim() || sending}
          style={[styles.sendBtn, { backgroundColor: colors.primary, opacity: text.trim() ? 1 : 0.45 }]}
        >
          <Ionicons name="send" size={17} color={colors.primaryText} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  bubbleRow: { flexDirection: "row", marginBottom: 8 },
  bubble: { maxWidth: "78%", paddingHorizontal: 13, paddingVertical: 9, borderRadius: radius.lg },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingTop: 12,
    paddingBottom: 12,
    fontFamily: fonts.body,
    fontSize: 14.5
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" }
});
