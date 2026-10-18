import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, Modal, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome } from '@expo/vector-icons';
import { THEMES, THEME_CATEGORIES, DEFAULT_THEME_ID, getTheme, themeThumbUrl } from '../utils/chatTheme';
import ChatThemePreview from './ChatThemePreview';

const BG = '#0B0B0B';
const CARD = '#151515';
const BORDER = '#272727';
const TEXT = '#FFFFFF';
const MUTED = '#9A9A9A';
const RED = '#E11D2A';

/* Thumbnail with a two-step fallback: transformed render URL -> original URL -> gradient. */
function ThemeThumb({ theme }) {
  const [stage, setStage] = useState(0); // 0 = thumb, 1 = original, 2 = gradient
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setStage(0);
    setLoading(true);
  }, [theme.id]);

  if (!theme.wallpaperUrl || stage >= 2) {
    return <LinearGradient colors={[theme.backgroundColor, theme.incomingBubbleColor]} style={styles.thumb} />;
  }

  const thumb = themeThumbUrl(theme.wallpaperUrl);
  const src = stage === 0 ? thumb : theme.wallpaperUrl;

  return (
    <View style={styles.thumb}>
      {loading && (
        <View style={styles.thumbLoading}>
          <ActivityIndicator size="small" color={theme.accentColor} />
        </View>
      )}
      <Image
        source={{ uri: src }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        onLoad={() => setLoading(false)}
        onError={() => {
          if (stage === 0 && thumb !== theme.wallpaperUrl) setStage(1);
          else setStage(2);
        }}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.20)' }]} />
    </View>
  );
}

const dot = (c) => ({
  width: 16,
  height: 16,
  borderRadius: 8,
  backgroundColor: c,
  marginRight: 5,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.28)',
});

/**
 * Chat wallpaper picker.
 *
 * Step 1: searchable, filterable grid of every theme (thumbnail + bubble swatch).
 * Step 2: full chat preview with Apply / Cancel.
 */
export default function ChatThemePicker({ visible, current, name, onClose, onApply, onReset }) {
  const [pick, setPick] = useState(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [busy, setBusy] = useState(false);

  const t = pick ? getTheme(pick) : null;
  const isCurrent = pick && pick === current;
  const isDefault = current ? current === DEFAULT_THEME_ID : true;

  useEffect(() => {
    if (!visible) {
      setPick(null);
      setQuery('');
      setCategory('All');
      setBusy(false);
    }
  }, [visible]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return THEMES.filter((item) => {
      if (category !== 'All' && item.category !== category) return false;
      if (!q) return true;
      return `${item.name} ${item.category}`.toLowerCase().includes(q);
    });
  }, [query, category]);

  const close = () => {
    setPick(null);
    onClose?.();
  };

  const apply = async () => {
    if (!pick) return;
    setBusy(true);
    try {
      await onApply?.(pick);
      close();
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    try {
      await onReset?.();
      close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={() => (pick ? setPick(null) : close())}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <StatusBar barStyle="light-content" />

        <View style={styles.header}>
          <Pressable onPress={() => (pick ? setPick(null) : close())} hitSlop={12} style={styles.headerBtn}>
            <FontAwesome name={pick ? 'angle-left' : 'times'} size={pick ? 28 : 22} color={TEXT} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {pick ? t?.name : 'Chat wallpapers'}
          </Text>
          <View style={styles.headerBtn} />
        </View>

        {!pick ? (
          <>
            <View style={styles.searchWrap}>
              <FontAwesome name="search" size={15} color={MUTED} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search wallpapers"
                placeholderTextColor="#6B6B6B"
                style={styles.search}
                autoCorrect={false}
              />
              {!!query && (
                <Pressable onPress={() => setQuery('')} hitSlop={10}>
                  <FontAwesome name="times-circle" size={16} color={MUTED} />
                </Pressable>
              )}
            </View>

            <View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chips}
              >
                {THEME_CATEGORIES.map((c) => {
                  const on = c === category;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => setCategory(c)}
                      style={[styles.chip, on && styles.chipOn]}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{c}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <FlatList
              data={filtered}
              keyExtractor={(x) => x.id}
              numColumns={2}
              initialNumToRender={6}
              maxToRenderPerBatch={6}
              windowSize={5}
              removeClippedSubviews
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.grid}
              ListHeaderComponent={
                <View style={styles.listHeader}>
                  <Text style={styles.hint}>
                    Pick a wallpaper. You will see a preview first, and {name} will get the same theme.
                  </Text>
                  <Pressable style={[styles.resetBtn, isDefault && styles.resetDisabled]} onPress={reset} disabled={busy || isDefault}>
                    <FontAwesome name="refresh" size={13} color={isDefault ? MUTED : RED} />
                    <Text style={[styles.resetText, isDefault && { color: MUTED }]}>Reset to default</Text>
                  </Pressable>
                </View>
              }
              ListEmptyComponent={
                <View style={styles.empty}>
                  <FontAwesome name="image" size={30} color="#3A3A3A" />
                  <Text style={styles.emptyText}>No wallpapers match your search.</Text>
                </View>
              }
              renderItem={({ item }) => {
                const on = current === item.id;
                return (
                  <Pressable
                    onPress={() => setPick(item.id)}
                    style={[
                      styles.card,
                      { borderColor: on ? item.accentColor : BORDER },
                      on && { shadowColor: item.glowColor || item.accentColor, shadowOpacity: 0.5, shadowRadius: 10, elevation: 6 },
                    ]}
                  >
                    <ThemeThumb theme={item} />
                    <View style={styles.cardBody}>
                      <Text style={styles.cardName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.cardCat} numberOfLines={1}>
                        {item.id === DEFAULT_THEME_ID ? 'Classic' : item.category}
                      </Text>
                      <View style={styles.dots}>
                        <View style={dot(item.outgoingBubbleColor)} />
                        <View style={dot(item.incomingBubbleColor)} />
                        <View style={dot(item.accentColor)} />
                      </View>
                    </View>
                    {on && (
                      <View style={[styles.currentBadge, { backgroundColor: item.accentColor }]}>
                        <FontAwesome name="check" size={9} color="#0B0B0B" />
                        <Text style={styles.currentText}>CURRENT</Text>
                      </View>
                    )}
                  </Pressable>
                );
              }}
            />
          </>
        ) : (
          <ScrollView contentContainerStyle={styles.previewWrap} keyboardShouldPersistTaps="handled">
            <ChatThemePreview theme={t} name={name} />

            <Text style={[styles.previewHint, { color: t.text }]}>
              This is how your chat will look. {name} will see the same theme.
            </Text>

            <Pressable
              onPress={apply}
              disabled={busy || isCurrent}
              style={[
                styles.applyBtn,
                {
                  backgroundColor: t.sendButtonColor || t.accentColor,
                  shadowColor: t.glowColor || t.accentColor,
                  shadowOpacity: isCurrent || busy ? 0 : t.glowIntensity || 0,
                  shadowRadius: 12,
                  elevation: isCurrent ? 0 : 6,
                },
                (busy || isCurrent) && { opacity: 0.7 },
              ]}
            >
              {busy ? (
                <ActivityIndicator color={t.sendText} />
              ) : (
                <Text style={[styles.applyText, { color: t.sendText }]}>
                  {isCurrent ? 'Already applied' : 'Apply theme'}
                </Text>
              )}
            </Pressable>

            <Pressable onPress={() => setPick(null)} style={styles.secondaryBtn}>
              <Text style={[styles.secondaryText, { color: t.text }]}>Choose another wallpaper</Text>
            </Pressable>

            <Pressable onPress={reset} disabled={busy || isDefault} style={styles.secondaryBtn}>
              <Text style={[styles.secondaryText, { color: isDefault ? MUTED : t.accentColor }]}>
                Reset to default
              </Text>
            </Pressable>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG, paddingTop: 44 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 8 },
  headerBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', color: TEXT, fontSize: 17, fontWeight: '700' },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    marginBottom: 8,
    paddingHorizontal: 13,
    height: 42,
    borderRadius: 21,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
  },
  search: { flex: 1, color: TEXT, marginLeft: 9, fontSize: 14.5, paddingVertical: 0 },

  chips: { paddingHorizontal: 10, paddingBottom: 8 },
  chip: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  chipOn: { backgroundColor: RED, borderColor: RED },
  chipText: { color: '#CFCFCF', fontSize: 12.5, fontWeight: '600' },
  chipTextOn: { color: '#fff' },

  grid: { paddingHorizontal: 8, paddingBottom: 40 },
  listHeader: { paddingHorizontal: 6, paddingBottom: 6 },
  hint: { color: MUTED, fontSize: 12.5, lineHeight: 18, marginBottom: 10 },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD,
  },
  resetDisabled: { opacity: 0.6 },
  resetText: { color: RED, fontSize: 12.5, fontWeight: '700', marginLeft: 7 },

  card: {
    flex: 1,
    margin: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    overflow: 'hidden',
    backgroundColor: CARD,
    shadowOffset: { width: 0, height: 0 },
  },
  thumb: { height: 96, width: '100%', backgroundColor: '#1C1C1C', overflow: 'hidden' },
  thumbLoading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: 9 },
  cardName: { color: TEXT, fontWeight: '800', fontSize: 14 },
  cardCat: { color: MUTED, fontSize: 10.5, marginTop: 1, marginBottom: 7, minHeight: 13 },
  dots: { flexDirection: 'row' },
  currentBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  currentText: { color: '#0B0B0B', fontSize: 8.5, fontWeight: '900', marginLeft: 4, letterSpacing: 0.3 },

  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: MUTED, marginTop: 12, fontSize: 13 },

  previewWrap: { padding: 18, paddingBottom: 40 },
  previewHint: { opacity: 0.8, textAlign: 'center', marginTop: 14, fontSize: 12.5, lineHeight: 18 },
  applyBtn: {
    marginTop: 16,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
  },
  applyText: { fontWeight: '800', fontSize: 16 },
  secondaryBtn: { height: 48, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 14, fontWeight: '600', opacity: 0.9 },
});
