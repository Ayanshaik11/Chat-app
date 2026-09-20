import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { onAuthStateChanged } from "firebase/auth";
import { useFonts } from "expo-font";
import { Poppins_600SemiBold, Poppins_700Bold } from "@expo-google-fonts/poppins";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from "@expo-google-fonts/inter";

import { auth } from "./src/firebase";
import { configureGoogle } from "./src/lib/auth";
import { loadFeedbackSettings } from "./src/lib/feedback";
import { AppProvider, useApp, useColors } from "./src/lib/AppContext";
import { ensureProfile, logActivity, watchIncomingRequests, watchNotifications, watchProfile } from "./src/lib/data";
import { palettes } from "./src/theme";

import LoginScreen from "./src/screens/LoginScreen";
import HomeScreen from "./src/screens/HomeScreen";
import DiscoverScreen from "./src/screens/DiscoverScreen";
import MessagesScreen from "./src/screens/MessagesScreen";
import NotificationsScreen from "./src/screens/NotificationsScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import EditProfileScreen from "./src/screens/EditProfileScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import NewPostScreen from "./src/screens/NewPostScreen";
import ChatScreen from "./src/screens/ChatScreen";
import StoryScreen from "./src/screens/StoryScreen";
import PostScreen from "./src/screens/PostScreen";

configureGoogle();

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TAB_ICONS = {
  Home: ["home", "home-outline"],
  Discover: ["search", "search-outline"],
  Messages: ["chatbubble", "chatbubble-outline"],
  Alerts: ["heart", "heart-outline"],
  Profile: ["person", "person-outline"]
};

function Tabs() {
  const colors = useColors();
  const { profile } = useApp();
  const [badge, setBadge] = useState(0);

  useEffect(() => {
    let unread = 0;
    let requests = 0;
    const apply = () => setBadge(unread + requests);

    const stopNotes = watchNotifications(profile.uid, (items) => {
      unread = items.filter((item) => !item.read).length;
      apply();
    });
    const stopRequests = watchIncomingRequests(profile.uid, (items) => {
      requests = items.length;
      apply();
    });

    return () => {
      stopNotes();
      stopRequests();
    };
  }, [profile.uid]);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.faint,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          height: 62,
          paddingTop: 8
        },
        tabBarIcon: ({ focused, color }) => {
          const [on, off] = TAB_ICONS[route.name];
          return <Ionicons name={focused ? on : off} size={24} color={color} />;
        }
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Discover" component={DiscoverScreen} />
      <Tab.Screen name="Messages" component={MessagesScreen} />
      <Tab.Screen
        name="Alerts"
        component={NotificationsScreen}
        options={{ tabBarBadge: badge || undefined, tabBarBadgeStyle: { backgroundColor: colors.danger } }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function Navigation() {
  const colors = useColors();

  const navTheme = {
    ...DefaultTheme,
    dark: colors.mode === "dark",
    colors: {
      ...DefaultTheme.colors,
      background: colors.bg,
      card: colors.bg,
      text: colors.text,
      border: colors.border,
      primary: colors.primary
    }
  };

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={colors.mode === "dark" ? "light" : "dark"} />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={Tabs} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="User" component={ProfileScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="NewPost" component={NewPostScreen} />
        <Stack.Screen name="Post" component={PostScreen} />
        <Stack.Screen name="Story" component={StoryScreen} options={{ animation: "fade" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function Loading({ light = false }) {
  const colors = light ? palettes.light : palettes.dark;
  return (
    <View style={[styles.center, { backgroundColor: colors.bg }]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState(undefined); // undefined = still checking
  const [profile, setProfile] = useState(null);
  const [ready, setReady] = useState(false);

  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold,
    Poppins_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold
  });

  useEffect(() => {
    loadFeedbackSettings().finally(() => setReady(true));

    return onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (!user) setProfile(null);
    });
  }, []);

  // The Google account UID is the user id - the profile document is created on first login
  useEffect(() => {
    if (!firebaseUser) return undefined;

    let stop;
    ensureProfile(firebaseUser)
      .then((created) => {
        setProfile(created);
        logActivity(created, "login").catch(() => {});
        stop = watchProfile(firebaseUser.uid, (live) => live && setProfile(live));
      })
      .catch((error) => console.error("Could not load profile", error));

    return () => stop?.();
  }, [firebaseUser?.uid]);

  if (!ready || !fontsLoaded || firebaseUser === undefined) {
    return (
      <SafeAreaProvider>
        <Loading />
      </SafeAreaProvider>
    );
  }

  if (!firebaseUser) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <LoginScreen />
      </SafeAreaProvider>
    );
  }

  if (!profile) {
    return (
      <SafeAreaProvider>
        <Loading />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AppProvider profile={profile} firebaseUser={firebaseUser}>
        <Navigation />
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" }
});
