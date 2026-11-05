import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/SettingsContext';

/*
 Renders King X AI answers:
  - ```code``` becomes its own block with a language label, simple colours and a Copy button
  - **bold**, `inline code`, links, bullet / numbered lists, headings
  - TypedMarkdown reveals the text like typing
*/

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

/* ---------------- parsing ---------------- */

export function parseBlocks(source) {
  const lines = String(source || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let para = [];
  const flush = () => {
    if (para.length) blocks.push({ type: 'p', text: para.join('\n') });
    para = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const fence = /^\s*```(.*)$/.exec(line);

    if (fence) {
      flush();
      const lang = fence[1].trim().split(/\s+/)[0] || '';
      const code = [];
      let closed = false;
      i += 1;
      while (i < lines.length) {
        if (/^\s*```\s*$/.test(lines[i])) { closed = true; break; }
        code.push(lines[i]);
        i += 1;
      }
      blocks.push({ type: 'code', lang, code: code.join('\n'), closed });
      continue;
    }

    if (!line.trim()) { flush(); continue; }

    let m = /^(#{1,3})\s+(.*)$/.exec(line);
    if (m) { flush(); blocks.push({ type: 'h', level: m[1].length, text: m[2] }); continue; }

    m = /^\s*[-*•]\s+(.*)$/.exec(line);
    if (m) { flush(); blocks.push({ type: 'li', marker: '•', text: m[1] }); continue; }

    m = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
    if (m) { flush(); blocks.push({ type: 'li', marker: `${m[1]}.`, text: m[2] }); continue; }

    m = /^>\s?(.*)$/.exec(line);
    if (m) { flush(); blocks.push({ type: 'quote', text: m[1] }); continue; }

    para.push(line);
  }
  flush();
  return blocks;
}

/* ---------------- tiny syntax colours ---------------- */

const KEYWORDS = new Set(
  ('const let var function return if else for while do switch case break continue new class extends import from export default async await try catch finally throw typeof instanceof in of this null undefined true false ' +
    'def lambda None True False elif pass with as yield print public private protected static void int string float double bool boolean struct interface type enum fn mut impl use pub match self ' +
    'echo then fi done select from where insert update delete create table package func go defer range map chan').split(' ')
);
const HASH_LANGS = new Set(['py', 'python', 'sh', 'bash', 'shell', 'zsh', 'yaml', 'yml', 'ruby', 'rb', 'r', 'toml', 'dockerfile']);

const COLORS = { kw: '#FF7B72', str: '#A5D6FF', cm: '#8B949E', num: '#79C0FF', fn: '#D2A8FF', plain: '#E6EDF3' };

function tokenizeLine(line, lang) {
  const l = String(lang || '').toLowerCase();
  const comment = HASH_LANGS.has(l) ? '#.*$' : l === 'sql' ? '--.*$' : '\\/\\/.*$|\\/\\*.*?\\*\\/';
  const re = new RegExp(
    `(${comment})|("(?:[^"\\\\]|\\\\.)*"?|'(?:[^'\\\\]|\\\\.)*'?|\`(?:[^\`\\\\]|\\\\.)*\`?)|(\\b\\d+(?:\\.\\d+)?\\b)|([A-Za-z_$][\\w$]*)(?=\\()|([A-Za-z_$][\\w$]*)`,
    'g'
  );
  const out = [];
  let last = 0;
  let m;
  while ((m = re.exec(line))) {
    if (m.index > last) out.push({ t: 'plain', v: line.slice(last, m.index) });
    if (m[1]) out.push({ t: 'cm', v: m[0] });
    else if (m[2]) out.push({ t: 'str', v: m[0] });
    else if (m[3]) out.push({ t: 'num', v: m[0] });
    else if (m[4]) out.push({ t: KEYWORDS.has(m[0]) ? 'kw' : 'fn', v: m[0] });
    else out.push({ t: KEYWORDS.has(m[0]) ? 'kw' : 'plain', v: m[0] });
    last = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex += 1;
  }
  if (last < line.length) out.push({ t: 'plain', v: line.slice(last) });
  return out;
}

/* ---------------- code block with Copy ---------------- */

export async function copyText(text) {
  try {
    await Clipboard.setStringAsync(String(text || ''));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

export function CopyButton({ text, label = 'Copy', color = '#C9D1D9', size = 15 }) {
  const [done, setDone] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <Pressable
      hitSlop={8}
      onPress={async () => {
        if (await copyText(text)) {
          setDone(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setDone(false), 1600);
        }
      }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
    >
      <Ionicons name={done ? 'checkmark' : 'copy-outline'} size={size} color={done ? '#34D399' : color} />
      <Text style={{ color: done ? '#34D399' : color, fontSize: 12, fontWeight: '600' }}>{done ? 'Copied' : label}</Text>
    </Pressable>
  );
}

const CodeBlock = memo(function CodeBlock({ lang, code }) {
  const spans = useMemo(() => {
    const lines = code.split('\n');
    const out = [];
    lines.forEach((line, i) => {
      tokenizeLine(line, lang).forEach((tok, j) => out.push(<Text key={`${i}-${j}`} style={{ color: COLORS[tok.t] }}>{tok.v}</Text>));
      if (i < lines.length - 1) out.push(<Text key={`n${i}`}>{'\n'}</Text>);
    });
    return out;
  }, [code, lang]);

  return (
    <View style={{ borderRadius: 12, overflow: 'hidden', backgroundColor: '#0D1117', borderWidth: 1, borderColor: '#262C36', marginVertical: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#161B22' }}>
        <Text style={{ color: '#8B949E', fontSize: 12, fontWeight: '600' }}>{lang || 'code'}</Text>
        <CopyButton text={code} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled contentContainerStyle={{ padding: 12 }}>
        <Text selectable style={{ fontFamily: MONO, fontSize: 12.5, lineHeight: 19, color: COLORS.plain }}>
          {spans.length ? spans : ' '}
        </Text>
      </ScrollView>
    </View>
  );
});

/* ---------------- inline text ---------------- */

const INLINE = /(`[^`\n]+`|\*\*[^*\n]+?\*\*|https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g;

function Inline({ text, color, linkColor, codeBg, base }) {
  const parts = useMemo(() => {
    const out = [];
    let last = 0;
    let m;
    INLINE.lastIndex = 0;
    while ((m = INLINE.exec(text))) {
      if (m.index > last) out.push({ k: 't', v: text.slice(last, m.index) });
      const v = m[0];
      if (v.startsWith('`')) out.push({ k: 'c', v: v.slice(1, -1) });
      else if (v.startsWith('**')) out.push({ k: 'b', v: v.slice(2, -2) });
      else out.push({ k: 'l', v });
      last = m.index + v.length;
    }
    if (last < text.length) out.push({ k: 't', v: text.slice(last) });
    return out;
  }, [text]);

  return parts.map((p, i) => {
    if (p.k === 'c') return <Text key={i} style={{ fontFamily: MONO, fontSize: base * 0.9, backgroundColor: codeBg, color }}>{` ${p.v} `}</Text>;
    if (p.k === 'b') return <Text key={i} style={{ fontWeight: '700' }}>{p.v}</Text>;
    if (p.k === 'l') return <Text key={i} onPress={() => Linking.openURL(p.v).catch(() => {})} style={{ color: linkColor, textDecorationLine: 'underline' }}>{p.v}</Text>;
    return <Text key={i}>{p.v}</Text>;
  });
}

/* ---------------- whole answer ---------------- */

export const Markdown = memo(function Markdown({ text, size = 15 }) {
  const { colors, fonts } = useTheme();
  const blocks = useMemo(() => parseBlocks(text), [text]);
  const body = { fontFamily: fonts.regular, fontSize: size, lineHeight: size * 1.5, color: colors.text };
  const inline = { color: colors.text, linkColor: colors.primary, codeBg: colors.inputBg, base: size };

  return (
    <View style={{ gap: 6 }}>
      {blocks.map((b, i) => {
        if (b.type === 'code') return <CodeBlock key={i} lang={b.lang} code={b.code} />;
        if (b.type === 'h') {
          return (
            <Text key={i} selectable style={[body, { fontFamily: fonts.bold, fontSize: size + (b.level === 1 ? 4 : b.level === 2 ? 2 : 1), marginTop: 4 }]}>
              <Inline text={b.text} {...inline} />
            </Text>
          );
        }
        if (b.type === 'li') {
          return (
            <View key={i} style={{ flexDirection: 'row', paddingLeft: 4 }}>
              <Text style={[body, { width: 22, color: colors.primary, fontFamily: fonts.semibold }]}>{b.marker}</Text>
              <Text selectable style={[body, { flex: 1 }]}><Inline text={b.text} {...inline} /></Text>
            </View>
          );
        }
        if (b.type === 'quote') {
          return (
            <View key={i} style={{ borderLeftWidth: 3, borderLeftColor: colors.primary, paddingLeft: 10 }}>
              <Text selectable style={[body, { color: colors.subtext }]}><Inline text={b.text} {...inline} /></Text>
            </View>
          );
        }
        return <Text key={i} selectable style={body}><Inline text={b.text} {...inline} /></Text>;
      })}
    </View>
  );
});

/* ---------------- typing effect ---------------- */

const isHighSurrogate = (code) => code >= 0xd800 && code <= 0xdbff;

// Shows `text` a few characters at a time. skipKey > 0 finishes it at once (Stop button).
export function TypedMarkdown({ text, skipKey = 0, onDone, size }) {
  const [count, setCount] = useState(0);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const total = text.length;

  useEffect(() => {
    const step = Math.max(1, Math.ceil(total / 200)); // long answers type faster, always about 4s at most
    const id = setInterval(() => setCount((c) => Math.min(total, c + step)), 22);
    return () => clearInterval(id);
  }, [total]);

  useEffect(() => { if (skipKey > 0) setCount(total); }, [skipKey, total]);

  useEffect(() => {
    if (count >= total && !doneRef.current) {
      doneRef.current = true;
      onDoneRef.current?.();
    }
  }, [count, total]);

  let end = count;
  if (end < total && isHighSurrogate(text.charCodeAt(end - 1))) end += 1;
  const typing = end < total;

  return <Markdown text={typing ? `${text.slice(0, end)}▍` : text} size={size} />;
}
