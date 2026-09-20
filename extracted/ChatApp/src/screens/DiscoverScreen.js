import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Empty, Header } from "../components/Screen";
import PersonRow, { RowAction } from "../components/PersonRow";
import { useApp, useColors } from "../lib/AppContext";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  searchPeople,
  sendFriendRequest,
  suggestedPeople,
  watchIncomingRequests,
  watchOutgoingRequests
} from "../lib/data";
import { feedback } from "../lib/feedback";
import { fonts, radius } from "../theme";

export default function DiscoverScreen({ navigation }) {
  const colors = useColors();
  const { profile } = useApp();

  const [text, setText] = useState("");
  const [results, setResults] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [outgoing, setOutgoing] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [workingOn, setWorkingOn] = useState(null);

  const friends = profile.friends || [];

  useEffect(() => {
    const stopOut = watchOutgoingRequests(profile.uid, setOutgoing);
    const stopIn = watchIncomingRequests(profile.uid, setIncoming);
    return () => {
      stopOut();
      stopIn();
    };
  }, [profile.uid]);

  useEffect(() => {
    suggestedPeople(profile.uid, friends).then(setSuggestions).catch(console.error);
  }, [profile.uid, friends.length]);

  // Search runs a moment after typing stops
  useEffect(() => {
    if (text.trim().length < 2) {
      setResults([]);
      return undefined;
    }

    setSearching(true);
    const timer = setTimeout(() => {
      searchPeople(text, profile.uid)
        .then(setResults)
        .catch((error) => {
          console.error(error);
          setResults([]);
        })
        .finally(() => setSearching(false));
    }, 350);

    return () => clearTimeout(timer);
  }, [text, profile.uid]);

  const sentTo = useMemo(() => new Set(outgoing.map((request) => request.to)), [outgoing]);
  const requestFrom = useMemo(() => new Map(incoming.map((request) => [request.from, request])), [incoming]);

  const send = useCallback(
    async (person) => {
      setWorkingOn(person.id);
      try {
        await sendFriendRequest(profile, person);
        feedback.success();
      } catch (error) {
        console.error(error);
        feedback.error();
        Alert.alert("Couldn't send request", "Check your connection.");
      } finally {
        setWorkingOn(null);
      }
    },
    [profile]
  );

  const undo = useCallback(
    async (person) => {
      setWorkingOn(person.id);
      try {
        await cancelFriendRequest(profile.uid, person.id);
        feedback.delete();
      } finally {
        setWorkingOn(null);
      }
    },
    [profile.uid]
  );

  const accept = useCallback(
    async (request) => {
      setWorkingOn(request.from);
      try {
        await acceptFriendRequest(profile, request);
        feedback.success();
      } finally {
        setWorkingOn(null);
      }
    },
    [profile]
  );

  function actionFor(person) {
    const busy = workingOn === person.id;

    if (friends.includes(person.id)) {
      return <RowAction label="Message" variant="soft" onPress={() => navigation.navigate("Chat", { person })} />;
    }
    if (requestFrom.has(person.id)) {
      return <RowAction label="Accept" busy={busy} onPress={() => accept(requestFrom.get(person.id))} />;
    }
    if (sentTo.has(person.id)) {
      return <RowAction label="Requested" variant="ghost" busy={busy} onPress={() => undo(person)} />;
    }
    return <RowAction label="Add friend" busy={busy} onPress={() => send(person)} />;
  }

  const showing = text.trim().length >= 2 ? results : suggestions;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Find people" subtitle="Search by Gmail address or name" />

      <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={17} color={colors.muted} />
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="name@gmail.com"
          placeholderTextColor={colors.faint}
          autoCapitalize="none"
          keyboardType="email-address"
          style={[styles.search, { color: colors.text }]}
        />
        {searching ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      </View>

      <FlatList
        data={showing}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <Text style={[styles.section, { color: colors.muted }]}>
            {text.trim().length >= 2 ? "Search results" : "People you may know"}
          </Text>
        }
        renderItem={({ item }) => (
          <PersonRow
            person={item}
            subtitle={item.email}
            action={actionFor(item)}
            onPress={() => navigation.navigate("User", { uid: item.id })}
          />
        )}
        ListEmptyComponent={
          <Empty
            icon="people-outline"
            title={text.trim().length >= 2 ? "Nobody found" : "No one to suggest yet"}
            note="Type at least two letters of someone's Gmail address. They must have opened the app once to appear here."
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 6,
    paddingHorizontal: 14,
    height: 46,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  search: { flex: 1, fontFamily: fonts.body, fontSize: 14.5 },
  section: { fontFamily: fonts.bodyMedium, fontSize: 12, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }
});
