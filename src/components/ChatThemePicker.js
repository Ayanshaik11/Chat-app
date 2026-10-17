import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StatusBar, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome } from '@expo/vector-icons';
import { THEMES, getTheme, mix } from '../utils/chatTheme';

const card = { flex: 1, margin: 6, borderRadius: 16, padding: 12, borderWidth: 1.5 };
const dot = (c) => ({ width: 16, height: 16, borderRadius: 8, backgroundColor: c, marginRight: 5, borderWidth: 1, borderColor: '#ffffff44' });

// What the chat will look like, drawn with the theme's own colours
function Preview({ t, name }) {
  const bubble = (mine, text, extra) => (
    <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%', marginVertical: 5, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 16, backgroundColor: mine ? t.you : t.other, borderBottomRightRadius: mine ? 4 : 16, borderBottomLeftRadius: mine ? 16 : 4, ...extra }}>
      <Text style={{ color: mine ? t.youText : t.text, fontSize: 14 }}>{text}</Text>
    </View>
  );
  return (
    <View style={{ borderRadius: 26, borderWidth: 2, borderColor: t.accent, overflow: 'hidden', height: 430 }}>
      <LinearGradient colors={[t.bg, mix(t.bg, t.accent, 0.2)]} style={{ flex: 1 }}>
        <View style={{ height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, backgroundColor: t.header, borderBottomWidth: 1, borderBottomColor: t.line }}>
          <FontAwesome name="angle-left" size={26} color={t.text} />
          <FontAwesome name="user-circle" size={30} color={t.accent} style={{ marginLeft: 12 }} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={{ color: t.text, fontWeight: '700' }} numberOfLines={1}>{name}</Text>
            <Text style={{ color: t.accent, fontSize: 11 }}>Online</Text>
          </View>
          <FontAwesome name="ellipsis-v" size={18} color={t.text} />
        </View>
        <View style={{ flex: 1, padding: 12, justifyContent: 'center' }}>
          {bubble(false, 'Bro, ready for the next project?')}
          {bubble(true, "Always! Let's make it epic 💪")}
          {bubble(false, "King X is not just a chat… it's a movement ⚡")}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: t.header, borderTopWidth: 1, borderTopColor: t.line }}>
          <View style={{ flex: 1, height: 40, borderRadius: 20, backgroundColor: t.panel, borderWidth: 1, borderColor: t.line, justifyContent: 'center', paddingHorizontal: 14 }}>
            <Text style={{ color: t.text, opacity: 0.5 }}>Message...</Text>
          </View>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.accent, marginLeft: 8, alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome name="send" size={16} color={t.accentText} />
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

// Step 1: list of themes. Step 2: preview with "Apply". Applying changes the theme for BOTH people in this chat.
export default function ChatThemePicker({ visible, current, name, onClose, onApply }) {
  const [pick, setPick] = useState(null);
  const [busy, setBusy] = useState(false);
  const t = pick ? getTheme(pick) : null;
  const close = () => { setPick(null); onClose(); };

  const apply = async () => {
    setBusy(true);
    try { await onApply(pick); close(); } finally { setBusy(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => (pick ? setPick(null) : close())} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: t ? t.bg : '#0D0D0D', paddingTop: 44 }}>
        <StatusBar hidden={false} barStyle="light-content" />

        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10 }}>
          <Pressable onPress={() => (pick ? setPick(null) : close())} hitSlop={12}><FontAwesome name={pick ? 'angle-left' : 'times'} size={pick ? 30 : 22} color="#fff" /></Pressable>
          <Text style={{ flex: 1, textAlign: 'center', color: '#fff', fontSize: 17, fontWeight: '700', marginRight: 22 }}>{pick ? t.name : 'Chat theme'}</Text>
        </View>

        {!pick ? (
          <FlatList
            data={THEMES}
            numColumns={2}
            keyExtractor={(x) => x.id}
            contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 30 }}
            ListHeaderComponent={<Text style={{ color: '#9A9A9A', fontSize: 12.5, marginHorizontal: 8, marginBottom: 8 }}>Pick a look. You will see a preview first, and {name} will get the same theme.</Text>}
            renderItem={({ item }) => (
              <Pressable onPress={() => setPick(item.id)} style={[card, { backgroundColor: item.bg, borderColor: current === item.id ? item.accent : item.other }]}>
                <Text style={{ color: item.text, fontWeight: '800', fontSize: 15 }} numberOfLines={1}>{item.name}</Text>
                <Text style={{ color: item.text, opacity: 0.65, fontSize: 10.5, marginTop: 2, minHeight: 28 }} numberOfLines={2}>{item.tag}</Text>
                <View style={{ flexDirection: 'row', marginTop: 8 }}>
                  <View style={dot(item.you)} /><View style={dot(item.other)} /><View style={dot(item.accent)} />
                </View>
                {current === item.id && <Text style={{ position: 'absolute', top: 10, right: 10, color: item.accent, fontSize: 10.5, fontWeight: '700' }}>CURRENT</Text>}
              </Pressable>
            )}
          />
        ) : (
          <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
            <Preview t={t} name={name} />
            <Text style={{ color: t.text, opacity: 0.75, textAlign: 'center', marginTop: 14, fontSize: 12.5 }}>
              This is how your chat will look. {name} will see the same theme.
            </Text>
            <Pressable onPress={apply} disabled={busy} style={{ marginTop: 16, height: 50, borderRadius: 25, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.6 : 1 }}>
              {busy ? <ActivityIndicator color={t.accentText} /> : <Text style={{ color: t.accentText, fontWeight: '800', fontSize: 16 }}>{current === pick ? 'Already applied' : 'Apply theme'}</Text>}
            </Pressable>
            <Pressable onPress={() => setPick(null)} style={{ height: 46, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: t.text, opacity: 0.8 }}>Choose another theme</Text>
            </Pressable>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}
