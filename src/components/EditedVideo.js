import React from 'react';
import { Text, View } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';

// "effects" are colour layers on top of the picture
export const FILTERS = [
  { n: 'Normal' },
  { n: 'Warm', c: ['rgba(255,150,40,.28)', 'rgba(255,90,0,.12)'] },
  { n: 'Cool', c: ['rgba(40,140,255,.28)', 'rgba(0,60,200,.12)'] },
  { n: 'Vintage', c: ['rgba(170,120,60,.38)', 'rgba(90,60,30,.25)'] },
  { n: 'Fade', c: ['rgba(255,255,255,.3)', 'rgba(255,255,255,.18)'] },
  { n: 'Rose', c: ['rgba(255,80,140,.3)', 'rgba(255,150,80,.14)'] },
  { n: 'Dream', c: ['rgba(150,90,255,.32)', 'rgba(255,120,200,.16)'] },
  { n: 'Noir', c: ['rgba(0,0,0,.5)', 'rgba(0,0,0,.22)'] },
];

export const textStyle = (it, fontSize) => ({
  color: it.bg ? (['#ffffff', '#FFD60A', '#34C759'].includes(it.color) ? '#000' : '#fff') : it.color,
  backgroundColor: it.bg ? it.color : 'transparent',
  fontSize, fontWeight: it.bold ? '800' : '400', textAlign: 'center',
  paddingHorizontal: it.bg ? 12 : 0, paddingVertical: it.bg ? 4 : 0, borderRadius: 8, overflow: 'hidden',
  textShadowColor: it.bg ? 'transparent' : 'rgba(0,0,0,.45)', textShadowRadius: 5,
});

export const textBox = { position: 'absolute', left: '5%', right: '5%', top: '40%', alignItems: 'center' };
const fill = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };

// Plays a video with the author's edits (zoom, move, effect, text) applied live.
// `edit` = { a: frame ratio, s: zoom, x/y: move (fraction of the frame), f: effect, t: [text...] }.
// Extra props (shouldPlay, isMuted, onPlaybackStatusUpdate...) go straight to the Video.
export default function EditedVideo({ uri, edit = {}, width, height, ...video }) {
  const ratio = edit.a || 9 / 16;
  const fw = Math.min(width, height * ratio), fh = fw / ratio;
  const f = FILTERS[edit.f || 0];
  return (
    <View style={{ width, height, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
      <View style={{ width: fw, height: fh, overflow: 'hidden' }}>
        <Video
          source={{ uri }}
          resizeMode={ResizeMode.COVER}
          style={{ width: fw, height: fh, transform: [{ translateX: (edit.x || 0) * fw }, { translateY: (edit.y || 0) * fh }, { scale: edit.s || 1 }] }}
          {...video}
        />
        {f.c && <LinearGradient colors={f.c} pointerEvents="none" style={fill} />}
        {(edit.t || []).map((it, i) => (
          <View key={i} pointerEvents="none" style={[textBox, { transform: [{ translateX: (it.x || 0) * fw }, { translateY: (it.y || 0) * fh }, { rotate: `${it.r || 0}rad` }, { scale: it.s || 1 }] }]}>
            <Text style={textStyle(it, it.sz * fw)}>{it.text}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
