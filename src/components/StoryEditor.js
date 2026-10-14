import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Image, Modal, PanResponder, Pressable, ScrollView, StatusBar, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';

const RED = '#E11D2A';
const COLORS = ['#ffffff', '#000000', '#E11D2A', '#FFD60A', '#34C759', '#0A84FF', '#BF5AF2', '#FF9F0A'];
// "effects" are colour layers on top of the photo
const FILTERS = [
  { n: 'Normal' },
  { n: 'Warm', c: ['rgba(255,150,40,.28)', 'rgba(255,90,0,.12)'] },
  { n: 'Cool', c: ['rgba(40,140,255,.28)', 'rgba(0,60,200,.12)'] },
  { n: 'Vintage', c: ['rgba(170,120,60,.38)', 'rgba(90,60,30,.25)'] },
  { n: 'Fade', c: ['rgba(255,255,255,.3)', 'rgba(255,255,255,.18)'] },
  { n: 'Rose', c: ['rgba(255,80,140,.3)', 'rgba(255,150,80,.14)'] },
  { n: 'Dream', c: ['rgba(150,90,255,.32)', 'rgba(255,120,200,.16)'] },
  { n: 'Noir', c: ['rgba(0,0,0,.5)', 'rgba(0,0,0,.22)'] },
];

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const dist = (a, b) => Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
const angle = (a, b) => Math.atan2(b.pageY - a.pageY, b.pageX - a.pageX);

// One finger = move, two fingers = pinch to zoom (and twist if rotate is on). Tap = onTap.
function useTransform({ min = 0.5, max = 8, rotate = false, onTap } = {}) {
  const tap = useRef(onTap); tap.current = onTap;
  const v = useRef({ x: new Animated.Value(0), y: new Animated.Value(0), s: new Animated.Value(1), r: new Animated.Value(0) }).current;
  const t = useRef({ x: 0, y: 0, s: 1, r: 0 }).current; // plain numbers
  const g = useRef({ n: 0, moved: false }).current;

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { g.n = 0; g.moved = false; },
    onPanResponderMove: (e, gs) => {
      const p = e.nativeEvent.touches;
      if (Math.abs(gs.dx) + Math.abs(gs.dy) > 6 || p.length > 1) g.moved = true;
      if (p.length !== g.n) { // finger added/removed: start from where we are now
        g.n = p.length; g.base = { ...t }; g.ox = gs.dx; g.oy = gs.dy;
        if (p.length > 1) { g.d0 = dist(p[0], p[1]); g.a0 = angle(p[0], p[1]); }
      }
      t.x = g.base.x + gs.dx - g.ox;
      t.y = g.base.y + gs.dy - g.oy;
      if (p.length > 1) {
        t.s = clamp(g.base.s * dist(p[0], p[1]) / g.d0, min, max);
        if (rotate) t.r = g.base.r + angle(p[0], p[1]) - g.a0;
      }
      v.x.setValue(t.x); v.y.setValue(t.y); v.s.setValue(t.s); v.r.setValue(t.r);
    },
    onPanResponderRelease: () => { if (!g.moved) tap.current?.(); },
  })).current;

  const style = { transform: [{ translateX: v.x }, { translateY: v.y }, { rotate: v.r.interpolate({ inputRange: [-100, 100], outputRange: ['-100rad', '100rad'] }) }, { scale: v.s }] };
  return { pan: pan.panHandlers, style };
}

function TextItem({ it, onTap }) {
  const tr = useTransform({ rotate: true, min: 0.4, max: 5, onTap: () => onTap(it) });
  const dark = ['#ffffff', '#FFD60A', '#34C759'].includes(it.color);
  return (
    <Animated.View {...tr.pan} style={[{ position: 'absolute', left: 20, right: 20, top: '40%', alignItems: 'center' }, tr.style]}>
      <Text style={{
        color: it.bg ? (dark ? '#000' : '#fff') : it.color, backgroundColor: it.bg ? it.color : 'transparent',
        fontSize: it.size, fontWeight: it.bold ? '800' : '400', textAlign: 'center', paddingHorizontal: it.bg ? 12 : 0, paddingVertical: it.bg ? 4 : 0,
        borderRadius: 8, overflow: 'hidden', textShadowColor: it.bg ? 'transparent' : 'rgba(0,0,0,.45)', textShadowRadius: 5,
      }}>{it.text}</Text>
    </Animated.View>
  );
}

// Full-screen story editor: zoom/move the photo, pick an effect, add text, then save as one picture.
export default function StoryEditor({ asset, onCancel, onDone }) {
  const { width, height } = useWindowDimensions();
  const fh = Math.min(height - 250, (width * 16) / 9), fw = (fh * 9) / 16;
  const frame = useRef(null);
  const img = useTransform();
  const [size, setSize] = useState({ w: asset.width || 0, h: asset.height || 0 });
  const [filter, setFilter] = useState(0);
  const [texts, setTexts] = useState([]);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!size.w) Image.getSize(asset.uri, (w, h) => setSize({ w, h }), () => setSize({ w: 1080, h: 1920 })); }, []);
  const k = size.w ? Math.max(fw / size.w, fh / size.h) : 1; // "cover" size inside the frame

  const newText = () => setEdit({ id: null, text: '', color: '#ffffff', bg: false, bold: true, size: 30 });
  const saveText = () => {
    const text = edit.text.trim();
    setTexts((l) => (edit.id ? l.filter((x) => x.id !== edit.id || text).map((x) => (x.id === edit.id ? { ...edit, text } : x)) : text ? [...l, { ...edit, text, id: Date.now() }] : l));
    setEdit(null);
  };
  const removeText = () => { setTexts((l) => l.filter((x) => x.id !== edit.id)); setEdit(null); };

  const save = async () => {
    setBusy(true);
    try {
      const uri = await captureRef(frame, { format: 'jpg', quality: 0.92, result: 'tmpfile', width: 1080, height: 1920 });
      onDone({ uri, type: 'image', mimeType: 'image/jpeg', width: 1080, height: 1920 });
    } catch (e) {
      setBusy(false);
      Alert.alert('Could not save', e?.message || 'Please try again.');
    }
  };

  const chip = { width: 22, height: 22, borderRadius: 11, marginRight: 8, borderWidth: 2 };
  const tool = (on) => ({ paddingHorizontal: 12, height: 34, borderRadius: 17, justifyContent: 'center', backgroundColor: on ? '#fff' : '#ffffff22' });

  return (
    <Modal visible animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <StatusBar hidden />

        <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, marginTop: 10 }}>
          <Pressable onPress={onCancel} hitSlop={12}><Ionicons name="close" size={28} color="#fff" /></Pressable>
          <Text style={{ color: '#aaa', fontSize: 12 }}>Pinch to zoom · drag to move</Text>
          <Pressable onPress={newText} hitSlop={10} style={tool(false)}><Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Aa</Text></Pressable>
        </View>

        {/* the picture that gets saved */}
        <View style={{ alignItems: 'center' }}>
          <View ref={frame} collapsable={false} style={{ width: fw, height: fh, backgroundColor: '#000', overflow: 'hidden', borderRadius: 14 }}>
            <Animated.Image
              source={{ uri: asset.uri }}
              style={[{ position: 'absolute', left: (fw - size.w * k) / 2, top: (fh - size.h * k) / 2, width: size.w * k, height: size.h * k }, img.style]}
            />
            {FILTERS[filter].c && <LinearGradient colors={FILTERS[filter].c} pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />}
            <View {...img.pan} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
            {texts.map((it) => <TextItem key={it.id} it={it} onTap={setEdit} />)}
          </View>
        </View>

        {/* effects + save */}
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: 18 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14 }}>
            {FILTERS.map((f, i) => (
              <Pressable key={f.n} onPress={() => setFilter(i)} style={{ marginRight: 10, alignItems: 'center' }}>
                <View style={{ width: 52, height: 68, borderRadius: 10, overflow: 'hidden', borderWidth: 2, borderColor: i === filter ? RED : 'transparent' }}>
                  <Image source={{ uri: asset.uri }} style={{ width: '100%', height: '100%' }} />
                  {f.c && <LinearGradient colors={f.c} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />}
                </View>
                <Text style={{ color: i === filter ? '#fff' : '#999', fontSize: 11, marginTop: 4 }}>{f.n}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable onPress={save} disabled={busy} style={{ marginHorizontal: 16, marginTop: 12, height: 48, borderRadius: 24, backgroundColor: RED, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.6 : 1 }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{busy ? 'Saving…' : 'Done'}</Text>
          </Pressable>
        </View>

        {/* add / edit text */}
        {edit && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,.82)', paddingTop: 50 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }}>
              {edit.id ? <Pressable onPress={removeText}><Ionicons name="trash-outline" size={24} color="#fff" /></Pressable> : <Pressable onPress={() => setEdit(null)}><Ionicons name="close" size={26} color="#fff" /></Pressable>}
              <Pressable onPress={saveText} style={tool(true)}><Text style={{ fontWeight: '700' }}>Done</Text></Pressable>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14 }}>
              <Pressable onPress={() => setEdit({ ...edit, bg: !edit.bg })} style={tool(edit.bg)}><Text style={{ color: edit.bg ? '#000' : '#fff', fontWeight: '700' }}>Background</Text></Pressable>
              <Pressable onPress={() => setEdit({ ...edit, bold: !edit.bold })} style={tool(edit.bold)}><Text style={{ color: edit.bold ? '#000' : '#fff', fontWeight: '800' }}>B</Text></Pressable>
              <Pressable onPress={() => setEdit({ ...edit, size: Math.max(16, edit.size - 4) })} style={tool(false)}><Text style={{ color: '#fff', fontWeight: '700' }}>A−</Text></Pressable>
              <Pressable onPress={() => setEdit({ ...edit, size: Math.min(64, edit.size + 4) })} style={tool(false)}><Text style={{ color: '#fff', fontWeight: '700' }}>A+</Text></Pressable>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 16 }}>
              {COLORS.map((c) => <Pressable key={c} onPress={() => setEdit({ ...edit, color: c })} style={[chip, { backgroundColor: c, borderColor: edit.color === c ? '#fff' : '#ffffff55' }]} />)}
            </View>
            <TextInput
              autoFocus multiline value={edit.text} onChangeText={(text) => setEdit({ ...edit, text })} placeholder="Type something…" placeholderTextColor="#777" maxLength={120}
              style={{ marginTop: 30, marginHorizontal: 24, textAlign: 'center', fontSize: edit.size, fontWeight: edit.bold ? '800' : '400', color: edit.color }}
            />
          </View>
        )}
      </View>
    </Modal>
  );
}
