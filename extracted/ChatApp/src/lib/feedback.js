import { Vibration } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "chat.feedback";

let settings = { sound: true, vibration: true };
let players = null;

export function getFeedbackSettings() {
  return { ...settings };
}

export async function loadFeedbackSettings() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) settings = { ...settings, ...JSON.parse(raw) };
  } catch (error) {
    // defaults are fine
  }
  return getFeedbackSettings();
}

export async function saveFeedbackSettings(next) {
  settings = { ...settings, ...next };
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(settings));
  } catch (error) {
    // not critical
  }
  return getFeedbackSettings();
}

// Sounds are optional - if expo-audio isn't available the app still runs
function getPlayers() {
  if (players) return players;
  try {
    const { createAudioPlayer } = require("expo-audio");
    players = {
      tap: createAudioPlayer(require("../../assets/sounds/tap.wav")),
      success: createAudioPlayer(require("../../assets/sounds/success.wav")),
      error: createAudioPlayer(require("../../assets/sounds/error.wav")),
      delete: createAudioPlayer(require("../../assets/sounds/delete.wav"))
    };
  } catch (error) {
    players = {};
  }
  return players;
}

function play(name) {
  if (!settings.sound) return;
  try {
    const player = getPlayers()[name];
    if (!player) return;
    player.seekTo(0);
    player.play();
  } catch (error) {
    // ignore
  }
}

function buzz(pattern) {
  if (!settings.vibration) return;
  try {
    Vibration.vibrate(pattern);
  } catch (error) {
    // ignore
  }
}

export const feedback = {
  tap() {
    play("tap");
    buzz(12);
  },
  success() {
    play("success");
    buzz(28);
  },
  error() {
    play("error");
    buzz([0, 40, 60, 40]);
  },
  delete() {
    play("delete");
    buzz(45);
  },
  message() {
    play("tap");
    buzz(18);
  }
};
