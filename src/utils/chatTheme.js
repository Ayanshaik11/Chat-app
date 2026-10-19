/*
 * King X — chat wallpaper + colour theme registry.
 *
 * This is the single source of truth for every chat wallpaper and its palette.
 * Nothing here makes a network request: the whole registry is bundled with the
 * app. Wallpaper bitmaps are the only remote assets, and they are served from
 * the private Supabase bucket through short-lived signed URLs minted by the
 * authenticated `/api/wallpapers` endpoint (keyed by theme `id`).
 *
 * Adding a wallpaper later:
 *   1. add its palette constant below (or reuse one), and
 *   2. add one entry to WALLPAPERS with a unique `id`, `file` and `palette`.
 * `getTheme()` picks it up automatically and the picker shows it.
 */

/* ---------- tiny colour helpers (no dependencies) ---------- */

const rgb = (hex) => {
  const h = String(hex || '#000').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const toHex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');

/** Mix colour `a` towards colour `b` by `t` (0..1). Both must be hex strings. */
export const mix = (a, b, t) => {
  const A = rgb(a);
  const B = rgb(b);
  return `#${A.map((v, i) => toHex(v + (B[i] - v) * t)).join('')}`;
};

/** Readable foreground colour for a hex background (dark text on light, light on dark). */
export const onColor = (bg, light = '#FFFFFF') => {
  const [r, g, b] = rgb(bg);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? '#04121A' : light;
};

const rgba = (hex, a = 0.42) => {
  const [r, g, b] = rgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

/** Hex colour -> rgba string with the given alpha. */
export const alpha = (hex, a = 1) => rgba(hex, a);

/* ---------- palettes ----------
 * Every palette defines the full set of colour slots the chat UI consumes.
 * `backgroundOverlayColor` is derived from the background when a theme does not
 * specify its own overlay.
 */

const palette = (p) => ({
  backgroundOverlayColor: p.backgroundOverlayColor || rgba(p.backgroundColor, 0.42),
  statusColor: p.statusColor || '#34D399',
  glowIntensity: p.glowIntensity ?? 0.35,
  specialEffect: p.specialEffect || null,
  ...p,
});

/* A — Orange Piccolo */
const ORANGE_PICCOLO = palette({
  backgroundColor: '#130D09',
  backgroundOverlayColor: 'rgba(19,13,9,0.38)',
  outgoingBubbleColor: '#FF8C24',
  outgoingTextColor: '#17110A',
  incomingBubbleColor: '#2B211B',
  incomingTextColor: '#FFF4E8',
  accentColor: '#FFB347',
  secondaryAccentColor: '#F15A24',
  timestampColor: '#C9B5A2',
  linkColor: '#FFD18A',
  inputBackgroundColor: '#211912',
  inputTextColor: '#FFF4E8',
  placeholderColor: '#B9A493',
  sendButtonColor: '#FF8C24',
  iconColor: '#FFD18A',
  replyPreviewColor: '#3A281B',
  borderColor: '#7E421B',
  glowColor: '#FF7A18',
  glowIntensity: 0.4,
  specialEffect: 'aura',
});

/* B — Ultra Instinct: silver & ice */
const ULTRA_INSTINCT = palette({
  backgroundColor: '#080D17',
  backgroundOverlayColor: 'rgba(8,13,23,0.40)',
  outgoingBubbleColor: '#DCEBFF',
  outgoingTextColor: '#101827',
  incomingBubbleColor: '#192437',
  incomingTextColor: '#F3F7FF',
  accentColor: '#A9C9F5',
  secondaryAccentColor: '#E9F4FF',
  timestampColor: '#A7B8D0',
  linkColor: '#A9D8FF',
  inputBackgroundColor: '#121C2D',
  inputTextColor: '#F3F7FF',
  placeholderColor: '#9EADC4',
  sendButtonColor: '#BFD9FF',
  iconColor: '#DCEBFF',
  replyPreviewColor: '#202F47',
  borderColor: '#607A9F',
  glowColor: '#BFD9FF',
  glowIntensity: 0.45,
  specialEffect: 'shimmer',
});

/* C — Ultra Ego: destruction purple */
const ULTRA_EGO = palette({
  backgroundColor: '#100817',
  backgroundOverlayColor: 'rgba(16,8,23,0.40)',
  outgoingBubbleColor: '#7C3AED',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#251333',
  incomingTextColor: '#F5EAFE',
  accentColor: '#B794F6',
  secondaryAccentColor: '#EC4899',
  timestampColor: '#C0ACD5',
  linkColor: '#D8B4FE',
  inputBackgroundColor: '#1B1028',
  inputTextColor: '#FFFFFF',
  placeholderColor: '#AA94BC',
  sendButtonColor: '#8B5CF6',
  iconColor: '#D8B4FE',
  replyPreviewColor: '#321744',
  borderColor: '#6936A5',
  glowColor: '#8B5CF6',
  glowIntensity: 0.5,
  specialEffect: 'pulse',
});

/* D — Naruto / Nine-Tails */
const NARUTO = palette({
  backgroundColor: '#160B06',
  backgroundOverlayColor: 'rgba(22,11,6,0.35)',
  outgoingBubbleColor: '#FF9F1C',
  outgoingTextColor: '#20120A',
  incomingBubbleColor: '#2B170D',
  incomingTextColor: '#FFF4E5',
  accentColor: '#FFD166',
  secondaryAccentColor: '#F04E23',
  timestampColor: '#C7AA8E',
  linkColor: '#FFD166',
  inputBackgroundColor: '#24140B',
  inputTextColor: '#FFF4E5',
  placeholderColor: '#BCA18A',
  sendButtonColor: '#FF9F1C',
  iconColor: '#FFD166',
  replyPreviewColor: '#3C2010',
  borderColor: '#8B4513',
  glowColor: '#FF8C00',
  glowIntensity: 0.45,
  specialEffect: 'chakra',
});

/* E — Beast Gohan */
const BEAST_GOHAN = palette({
  backgroundColor: '#0C0B18',
  outgoingBubbleColor: '#D9D9FF',
  outgoingTextColor: '#17132A',
  incomingBubbleColor: '#211B35',
  incomingTextColor: '#F5F2FF',
  accentColor: '#C084FC',
  secondaryAccentColor: '#F0E7FF',
  timestampColor: '#B4A9D0',
  linkColor: '#D8B4FE',
  inputBackgroundColor: '#171226',
  inputTextColor: '#F5F2FF',
  placeholderColor: '#A69ABF',
  sendButtonColor: '#C084FC',
  iconColor: '#E9D5FF',
  replyPreviewColor: '#302247',
  borderColor: '#7451A6',
  glowColor: '#A855F7',
  specialEffect: 'aura',
});

/* F — Shadow Monarch (Sung Jinwoo) */
const SHADOW_MONARCH = palette({
  backgroundColor: '#080610',
  outgoingBubbleColor: '#762BFF',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#171020',
  incomingTextColor: '#F2ECFF',
  accentColor: '#B78AFF',
  secondaryAccentColor: '#5721B5',
  timestampColor: '#A99DBD',
  linkColor: '#C4A1FF',
  inputBackgroundColor: '#110B1B',
  inputTextColor: '#F2ECFF',
  placeholderColor: '#9889AD',
  sendButtonColor: '#762BFF',
  iconColor: '#C4A1FF',
  replyPreviewColor: '#251538',
  borderColor: '#52258C',
  glowColor: '#762BFF',
  glowIntensity: 0.45,
  specialEffect: 'shadow',
});

/* G — Beerus */
const BEERUS = palette({
  backgroundColor: '#0A0B20',
  outgoingBubbleColor: '#6C4BD8',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#191B35',
  incomingTextColor: '#F0F1FF',
  accentColor: '#A78BFA',
  secondaryAccentColor: '#38BDF8',
  timestampColor: '#B0B4D0',
  linkColor: '#A5D8FF',
  inputBackgroundColor: '#12142B',
  inputTextColor: '#F0F1FF',
  placeholderColor: '#999FBE',
  sendButtonColor: '#6C4BD8',
  iconColor: '#C4B5FD',
  replyPreviewColor: '#252747',
  borderColor: '#5143A4',
  glowColor: '#8B5CF6',
  specialEffect: 'cosmic',
});

/* H — Vegeta (standard blue) */
const VEGETA = palette({
  backgroundColor: '#0A101B',
  outgoingBubbleColor: '#2867D8',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#172335',
  incomingTextColor: '#F1F6FF',
  accentColor: '#68A4FF',
  secondaryAccentColor: '#E05252',
  timestampColor: '#A6B6CC',
  linkColor: '#9ACBFF',
  inputBackgroundColor: '#111C2D',
  inputTextColor: '#F1F6FF',
  placeholderColor: '#94A6BF',
  sendButtonColor: '#2867D8',
  iconColor: '#9ACBFF',
  replyPreviewColor: '#20324A',
  borderColor: '#345C96',
  glowColor: '#3B82F6',
});

/* I — Attack Titan */
const ATTACK_TITAN = palette({
  backgroundColor: '#160C0B',
  outgoingBubbleColor: '#B94132',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#2A1B1A',
  incomingTextColor: '#F8EDEA',
  accentColor: '#EF6A4F',
  secondaryAccentColor: '#D5A16B',
  timestampColor: '#C7A9A1',
  linkColor: '#FFB29F',
  inputBackgroundColor: '#211514',
  inputTextColor: '#F8EDEA',
  placeholderColor: '#BDA19A',
  sendButtonColor: '#B94132',
  iconColor: '#FFB29F',
  replyPreviewColor: '#3B211E',
  borderColor: '#74352E',
  glowColor: '#D94B3B',
});

/* J — Itachi */
const ITACHI = palette({
  backgroundColor: '#10090F',
  outgoingBubbleColor: '#A71936',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#24121C',
  incomingTextColor: '#FFEFF2',
  accentColor: '#E54866',
  secondaryAccentColor: '#7A1D35',
  timestampColor: '#C3A2AC',
  linkColor: '#FF9EB1',
  inputBackgroundColor: '#1B1018',
  inputTextColor: '#FFEFF2',
  placeholderColor: '#B69AA4',
  sendButtonColor: '#A71936',
  iconColor: '#FF9EB1',
  replyPreviewColor: '#321825',
  borderColor: '#672035',
  glowColor: '#E11D48',
});

/* K — Madara */
const MADARA = palette({
  backgroundColor: '#0F080B',
  outgoingBubbleColor: '#A82736',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#25151A',
  incomingTextColor: '#FCEFF1',
  accentColor: '#EF4444',
  secondaryAccentColor: '#9F1239',
  timestampColor: '#C2A0A7',
  linkColor: '#FDA4AF',
  inputBackgroundColor: '#1B1014',
  inputTextColor: '#FCEFF1',
  placeholderColor: '#B59AA0',
  sendButtonColor: '#A82736',
  iconColor: '#FDA4AF',
  replyPreviewColor: '#351B23',
  borderColor: '#702430',
  glowColor: '#DC2626',
});

/* L — Sukuna */
const SUKUNA = palette({
  backgroundColor: '#140709',
  outgoingBubbleColor: '#D62839',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#291116',
  incomingTextColor: '#FFF0F1',
  accentColor: '#FF5263',
  secondaryAccentColor: '#7F1D1D',
  timestampColor: '#CBA2A5',
  linkColor: '#FFA4AC',
  inputBackgroundColor: '#200D11',
  inputTextColor: '#FFF0F1',
  placeholderColor: '#BA989D',
  sendButtonColor: '#D62839',
  iconColor: '#FFA4AC',
  replyPreviewColor: '#39171D',
  borderColor: '#78212B',
  glowColor: '#EF233C',
});

/* M — Hinata */
const HINATA = palette({
  backgroundColor: '#0A101E',
  outgoingBubbleColor: '#536FCB',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#19243C',
  incomingTextColor: '#F1F4FF',
  accentColor: '#A5B4FC',
  secondaryAccentColor: '#C4B5FD',
  timestampColor: '#AEB8D4',
  linkColor: '#C7D2FE',
  inputBackgroundColor: '#121B31',
  inputTextColor: '#F1F4FF',
  placeholderColor: '#9DA9C8',
  sendButtonColor: '#536FCB',
  iconColor: '#C7D2FE',
  replyPreviewColor: '#222F4A',
  borderColor: '#465AA3',
  glowColor: '#818CF8',
});

/* N — Cha Hae-In */
const CHA_HAE_IN = palette({
  backgroundColor: '#0A101A',
  outgoingBubbleColor: '#BD8B3B',
  outgoingTextColor: '#1D160A',
  incomingBubbleColor: '#202536',
  incomingTextColor: '#F5F4F0',
  accentColor: '#F3CC82',
  secondaryAccentColor: '#D6B7E8',
  timestampColor: '#B6B4C0',
  linkColor: '#F3CC82',
  inputBackgroundColor: '#151B28',
  inputTextColor: '#F5F4F0',
  placeholderColor: '#A8A7B3',
  sendButtonColor: '#D5A54C',
  iconColor: '#F3CC82',
  replyPreviewColor: '#2B3041',
  borderColor: '#6D5939',
  glowColor: '#D5A54C',
});

/* O — Beru */
const BERU = palette({
  backgroundColor: '#090A17',
  outgoingBubbleColor: '#4B45B8',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#191A2E',
  incomingTextColor: '#F1F0FF',
  accentColor: '#9C91FF',
  secondaryAccentColor: '#635BCE',
  timestampColor: '#AAA9CE',
  linkColor: '#C5BFFF',
  inputBackgroundColor: '#111326',
  inputTextColor: '#F1F0FF',
  placeholderColor: '#9898BB',
  sendButtonColor: '#635BCE',
  iconColor: '#C5BFFF',
  replyPreviewColor: '#252642',
  borderColor: '#46428F',
  glowColor: '#6D63FF',
});

/* P — Erwin / Wings of Freedom */
const ERWIN = palette({
  backgroundColor: '#10120F',
  outgoingBubbleColor: '#476B4C',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#222821',
  incomingTextColor: '#F1F4EE',
  accentColor: '#A4C49A',
  secondaryAccentColor: '#D6C8A6',
  timestampColor: '#B0B8AB',
  linkColor: '#C3E3B9',
  inputBackgroundColor: '#171D17',
  inputTextColor: '#F1F4EE',
  placeholderColor: '#9FA99B',
  sendButtonColor: '#476B4C',
  iconColor: '#C3E3B9',
  replyPreviewColor: '#2A3529',
  borderColor: '#465E42',
  glowColor: '#86B97A',
});

/* Q — Galaxy */
const GALAXY = palette({
  backgroundColor: '#060817',
  outgoingBubbleColor: '#4457B8',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#171B35',
  incomingTextColor: '#F1F2FF',
  accentColor: '#A78BFA',
  secondaryAccentColor: '#38BDF8',
  timestampColor: '#A6ACD1',
  linkColor: '#93C5FD',
  inputBackgroundColor: '#10132A',
  inputTextColor: '#F1F2FF',
  placeholderColor: '#9299BF',
  sendButtonColor: '#5969DB',
  iconColor: '#C4B5FD',
  replyPreviewColor: '#222747',
  borderColor: '#414C96',
  glowColor: '#7C3AED',
});

/* R — Purple Portal */
const PURPLE_PORTAL = palette({
  backgroundColor: '#100817',
  outgoingBubbleColor: '#8B5CF6',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#24152F',
  incomingTextColor: '#F8F0FF',
  accentColor: '#C084FC',
  secondaryAccentColor: '#E879F9',
  timestampColor: '#C0A6D1',
  linkColor: '#E9B8FF',
  inputBackgroundColor: '#1A1024',
  inputTextColor: '#F8F0FF',
  placeholderColor: '#AD95BE',
  sendButtonColor: '#8B5CF6',
  iconColor: '#E9B8FF',
  replyPreviewColor: '#331C43',
  borderColor: '#67399A',
  glowColor: '#A855F7',
});

/* S — Lava / Inferno */
const LAVA = palette({
  backgroundColor: '#100604',
  outgoingBubbleColor: '#E04420',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#25110D',
  incomingTextColor: '#FFF1EA',
  accentColor: '#FF8A36',
  secondaryAccentColor: '#FFCA57',
  timestampColor: '#C9A497',
  linkColor: '#FFD18B',
  inputBackgroundColor: '#1B0C08',
  inputTextColor: '#FFF1EA',
  placeholderColor: '#B99A8C',
  sendButtonColor: '#E04420',
  iconColor: '#FFD18B',
  replyPreviewColor: '#351810',
  borderColor: '#85311C',
  glowColor: '#FF4D00',
  glowIntensity: 0.45,
  specialEffect: 'fire',
});

/* T — Crystal Ice Cave */
const ICE_CAVE = palette({
  backgroundColor: '#04131C',
  outgoingBubbleColor: '#1C9DBD',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#102631',
  incomingTextColor: '#E9FAFF',
  accentColor: '#71E0F5',
  secondaryAccentColor: '#B9F2FF',
  timestampColor: '#9DC8D4',
  linkColor: '#A5F3FC',
  inputBackgroundColor: '#0B202B',
  inputTextColor: '#E9FAFF',
  placeholderColor: '#88B3C0',
  sendButtonColor: '#1C9DBD',
  iconColor: '#A5F3FC',
  replyPreviewColor: '#153441',
  borderColor: '#28677C',
  glowColor: '#22D3EE',
  specialEffect: 'ice',
});

/* U — Nature */
const NATURE = palette({
  backgroundColor: '#06130D',
  outgoingBubbleColor: '#397A4C',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#17281D',
  incomingTextColor: '#EFF8F0',
  accentColor: '#8CCF8A',
  secondaryAccentColor: '#B6D7A8',
  timestampColor: '#A3BCA5',
  linkColor: '#B7F7B1',
  inputBackgroundColor: '#102017',
  inputTextColor: '#EFF8F0',
  placeholderColor: '#8EA894',
  sendButtonColor: '#397A4C',
  iconColor: '#B7F7B1',
  replyPreviewColor: '#203B29',
  borderColor: '#315B3B',
  glowColor: '#4ADE80',
});

/* V — Bioluminescent Jellyfish */
const JELLYFISH = palette({
  backgroundColor: '#03101A',
  outgoingBubbleColor: '#168AAD',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#102431',
  incomingTextColor: '#E7F9FF',
  accentColor: '#61D9FF',
  secondaryAccentColor: '#8BFFF0',
  timestampColor: '#99C6D7',
  linkColor: '#9BE7FF',
  inputBackgroundColor: '#0A1D2A',
  inputTextColor: '#E7F9FF',
  placeholderColor: '#84AFBF',
  sendButtonColor: '#168AAD',
  iconColor: '#9BE7FF',
  replyPreviewColor: '#153344',
  borderColor: '#23647D',
  glowColor: '#22D3EE',
  specialEffect: 'glow',
});

/* W — Unknown Places / Cosmic Explorer */
const UNKNOWN_PLACES = palette({
  backgroundColor: '#0B0919',
  outgoingBubbleColor: '#6852B8',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#1C1930',
  incomingTextColor: '#F3F0FF',
  accentColor: '#C0A5FF',
  secondaryAccentColor: '#E0B6FF',
  timestampColor: '#ADA2C9',
  linkColor: '#D4C1FF',
  inputBackgroundColor: '#141127',
  inputTextColor: '#F3F0FF',
  placeholderColor: '#9C91B7',
  sendButtonColor: '#6852B8',
  iconColor: '#D4C1FF',
  replyPreviewColor: '#292343',
  borderColor: '#4B3D80',
  glowColor: '#9F7AEA',
});

/* X — Obsidian */
const OBSIDIAN = palette({
  backgroundColor: '#050505',
  outgoingBubbleColor: '#303030',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#171717',
  incomingTextColor: '#F5F5F5',
  accentColor: '#B8B8B8',
  secondaryAccentColor: '#777777',
  timestampColor: '#A0A0A0',
  linkColor: '#D6D6D6',
  inputBackgroundColor: '#101010',
  inputTextColor: '#F5F5F5',
  placeholderColor: '#858585',
  sendButtonColor: '#444444',
  iconColor: '#E5E5E5',
  replyPreviewColor: '#222222',
  borderColor: '#424242',
  glowColor: '#777777',
});

/* Y — Master Roshi */
const ROSHI = palette({
  backgroundColor: '#151007',
  outgoingBubbleColor: '#D5A52D',
  outgoingTextColor: '#171107',
  incomingBubbleColor: '#2A2417',
  incomingTextColor: '#FFF7DF',
  accentColor: '#FFE08A',
  secondaryAccentColor: '#E7C46B',
  timestampColor: '#C7B991',
  linkColor: '#FFE08A',
  inputBackgroundColor: '#211B10',
  inputTextColor: '#FFF7DF',
  placeholderColor: '#B9AB83',
  sendButtonColor: '#D5A52D',
  iconColor: '#FFE08A',
  replyPreviewColor: '#38301D',
  borderColor: '#76602A',
  glowColor: '#EAB308',
});

/* Z — Doraemon */
const DORAEMON = palette({
  backgroundColor: '#071421',
  outgoingBubbleColor: '#168AC5',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#142638',
  incomingTextColor: '#F0F9FF',
  accentColor: '#65C9FF',
  secondaryAccentColor: '#FF5B5B',
  timestampColor: '#A9C9DA',
  linkColor: '#9ADFFF',
  inputBackgroundColor: '#0E2030',
  inputTextColor: '#F0F9FF',
  placeholderColor: '#8BAFC3',
  sendButtonColor: '#168AC5',
  iconColor: '#9ADFFF',
  replyPreviewColor: '#19334A',
  borderColor: '#246A91',
  glowColor: '#38BDF8',
});

/* AA — Sakura Romance / Couple */
const COUPLE = palette({
  backgroundColor: '#190C17',
  outgoingBubbleColor: '#D96B9B',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#30202F',
  incomingTextColor: '#FFF0F7',
  accentColor: '#FFA6C9',
  secondaryAccentColor: '#F7C8D9',
  timestampColor: '#D0AABC',
  linkColor: '#FFB9D4',
  inputBackgroundColor: '#241521',
  inputTextColor: '#FFF0F7',
  placeholderColor: '#BFA0B1',
  sendButtonColor: '#D96B9B',
  iconColor: '#FFB9D4',
  replyPreviewColor: '#40263A',
  borderColor: '#8D456A',
  glowColor: '#F472B6',
});

/* AB — Neon Hearts */
const NEON_HEARTS = palette({
  backgroundColor: '#100610',
  outgoingBubbleColor: '#D63384',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#241225',
  incomingTextColor: '#FFF0FA',
  accentColor: '#FF70B8',
  secondaryAccentColor: '#FF9FDC',
  timestampColor: '#C9A3C0',
  linkColor: '#FFA3D5',
  inputBackgroundColor: '#1A0D1D',
  inputTextColor: '#FFF0FA',
  placeholderColor: '#B99BB3',
  sendButtonColor: '#D63384',
  iconColor: '#FFA3D5',
  replyPreviewColor: '#351A35',
  borderColor: '#783C70',
  glowColor: '#FF3DAD',
  specialEffect: 'pulse',
});

/* Legacy — Shinron (kept so an already-saved wallpaper still works) */
const SHINRON = palette({
  backgroundColor: '#051F16',
  outgoingBubbleColor: '#00C853',
  outgoingTextColor: '#04140C',
  incomingBubbleColor: '#0B3D2E',
  incomingTextColor: '#E8FFE9',
  accentColor: '#FFD700',
  secondaryAccentColor: '#22C55E',
  timestampColor: '#9FC7A8',
  linkColor: '#FFE082',
  inputBackgroundColor: '#08281C',
  inputTextColor: '#E8FFE9',
  placeholderColor: '#8FB89A',
  sendButtonColor: '#00A344',
  iconColor: '#FFE082',
  replyPreviewColor: '#0A3123',
  borderColor: '#1F5E3A',
  glowColor: '#FFD700',
  specialEffect: 'glow',
});

/* ---------- anime expansion — 29 new wallpapers ----------
 * Each palette is tuned to its artwork's dominant colours. Overlays stay
 * translucent so the image shows through, while bubbles, inputs and icons keep
 * readable text contrast in the chat UI.
 */

/* AC — Gotenks */
const GOTENKS = palette({
  backgroundColor: '#251344',
  backgroundOverlayColor: 'rgba(37,19,68,0.42)',
  outgoingBubbleColor: '#7C4DFF',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#2C1A52',
  incomingTextColor: '#F3ECFF',
  accentColor: '#B78AFF',
  secondaryAccentColor: '#FFD166',
  timestampColor: '#B4A6D6',
  linkColor: '#D9B8FF',
  inputBackgroundColor: '#1B0F35',
  inputTextColor: '#F3ECFF',
  placeholderColor: '#A794CE',
  sendButtonColor: '#8B5CF6',
  iconColor: '#D9B8FF',
  replyPreviewColor: '#34205E',
  borderColor: '#5A3AA0',
  glowColor: '#B78AFF',
});

/* AD — Goku SSJ God */
const GOKU_SSJ_GOD = palette({
  backgroundColor: '#3B1117',
  backgroundOverlayColor: 'rgba(59,17,23,0.40)',
  outgoingBubbleColor: '#E23B2E',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#4A1B20',
  incomingTextColor: '#FFECE8',
  accentColor: '#FF5548',
  secondaryAccentColor: '#FFB020',
  timestampColor: '#D3A29C',
  linkColor: '#FFA89C',
  inputBackgroundColor: '#2A0E13',
  inputTextColor: '#FFECE8',
  placeholderColor: '#C69A95',
  sendButtonColor: '#EF4136',
  iconColor: '#FFA89C',
  replyPreviewColor: '#58181F',
  borderColor: '#8C2A30',
  glowColor: '#FF3B2E',
});

/* AF — Goku Black SSJ Rose */
const GOKU_BLACK = palette({
  backgroundColor: '#260D26',
  backgroundOverlayColor: 'rgba(38,13,38,0.40)',
  outgoingBubbleColor: '#D63D9E',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#35132F',
  incomingTextColor: '#FFE9F5',
  accentColor: '#FF64B5',
  secondaryAccentColor: '#7A2B6B',
  timestampColor: '#C89AB8',
  linkColor: '#FF9ED1',
  inputBackgroundColor: '#1B081B',
  inputTextColor: '#FFE9F5',
  placeholderColor: '#BB90AC',
  sendButtonColor: '#E24AA8',
  iconColor: '#FF9ED1',
  replyPreviewColor: '#47163F',
  borderColor: '#7E2A63',
  glowColor: '#FF3D9E',
});

/* AG — Gogeta SSJ Blue */
const GOGETA_BLUE = palette({
  backgroundColor: '#081F40',
  backgroundOverlayColor: 'rgba(8,31,64,0.40)',
  outgoingBubbleColor: '#1E6FE0',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#10294F',
  incomingTextColor: '#EAF3FF',
  accentColor: '#35A7FF',
  secondaryAccentColor: '#FFC94D',
  timestampColor: '#9FB8D6',
  linkColor: '#8CCBFF',
  inputBackgroundColor: '#0A1A33',
  inputTextColor: '#EAF3FF',
  placeholderColor: '#8AA6C6',
  sendButtonColor: '#2E86F0',
  iconColor: '#8CCBFF',
  replyPreviewColor: '#123260',
  borderColor: '#1F4C8C',
  glowColor: '#35A7FF',
});

/* AI — Evil Trunks */
const EVIL_TRUNKS = palette({
  backgroundColor: '#25152D',
  backgroundOverlayColor: 'rgba(37,21,45,0.42)',
  outgoingBubbleColor: '#9333EA',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#2E1A38',
  incomingTextColor: '#F6ECFF',
  accentColor: '#D75BFF',
  secondaryAccentColor: '#6D28D9',
  timestampColor: '#BFA3CE',
  linkColor: '#E9A8FF',
  inputBackgroundColor: '#1B0F22',
  inputTextColor: '#F6ECFF',
  placeholderColor: '#AE93BC',
  sendButtonColor: '#A33BEA',
  iconColor: '#E9A8FF',
  replyPreviewColor: '#3A2149',
  borderColor: '#663A85',
  glowColor: '#D75BFF',
});

/* AJ — Gojo */
const GOJO = palette({
  backgroundColor: '#0C1B38',
  backgroundOverlayColor: 'rgba(12,27,56,0.40)',
  outgoingBubbleColor: '#2B6FD6',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#132647',
  incomingTextColor: '#EAF4FF',
  accentColor: '#82D8FF',
  secondaryAccentColor: '#1E40AF',
  timestampColor: '#9DB3D0',
  linkColor: '#A5E3FF',
  inputBackgroundColor: '#0A1730',
  inputTextColor: '#EAF4FF',
  placeholderColor: '#8AA2C4',
  sendButtonColor: '#2E7FE0',
  iconColor: '#A5E3FF',
  replyPreviewColor: '#16305A',
  borderColor: '#264A85',
  glowColor: '#82D8FF',
});

/* AK — Goku SSJ4 */
const GOKU_SSJ4 = palette({
  backgroundColor: '#35120D',
  backgroundOverlayColor: 'rgba(53,18,13,0.40)',
  outgoingBubbleColor: '#E05A20',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#441C13',
  incomingTextColor: '#FFEEE6',
  accentColor: '#FF7542',
  secondaryAccentColor: '#FFC64D',
  timestampColor: '#D2A490',
  linkColor: '#FFB189',
  inputBackgroundColor: '#240C08',
  inputTextColor: '#FFEEE6',
  placeholderColor: '#C39A87',
  sendButtonColor: '#E85E22',
  iconColor: '#FFB189',
  replyPreviewColor: '#52200F',
  borderColor: '#8A3418',
  glowColor: '#FF5A1E',
});

/* AM — Frieza Power */
const FRIEZA = palette({
  backgroundColor: '#26113F',
  backgroundOverlayColor: 'rgba(38,17,63,0.42)',
  outgoingBubbleColor: '#9A4DE0',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#311A4E',
  incomingTextColor: '#F4ECFF',
  accentColor: '#C28CFF',
  secondaryAccentColor: '#FF7BD5',
  timestampColor: '#B79FD0',
  linkColor: '#DDBBFF',
  inputBackgroundColor: '#1B0C2E',
  inputTextColor: '#F4ECFF',
  placeholderColor: '#A88FC2',
  sendButtonColor: '#A85AE8',
  iconColor: '#DDBBFF',
  replyPreviewColor: '#3D2160',
  borderColor: '#6A3AA0',
  glowColor: '#C28CFF',
});

/* AN — Obito */
const OBITO = palette({
  backgroundColor: '#20111A',
  backgroundOverlayColor: 'rgba(32,17,26,0.42)',
  outgoingBubbleColor: '#B03344',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#2C1A22',
  incomingTextColor: '#FBEDEF',
  accentColor: '#D94357',
  secondaryAccentColor: '#6D2A3A',
  timestampColor: '#C3A0A8',
  linkColor: '#F08A98',
  inputBackgroundColor: '#170B11',
  inputTextColor: '#FBEDEF',
  placeholderColor: '#B4919A',
  sendButtonColor: '#C13A4C',
  iconColor: '#F08A98',
  replyPreviewColor: '#3C1E29',
  borderColor: '#6E2A36',
  glowColor: '#D94357',
});

/* AO — Sasuke */
const SASUKE = palette({
  backgroundColor: '#111A35',
  backgroundOverlayColor: 'rgba(17,26,53,0.40)',
  outgoingBubbleColor: '#3A4FC0',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#182347',
  incomingTextColor: '#EDF1FF',
  accentColor: '#698BFF',
  secondaryAccentColor: '#A78BFA',
  timestampColor: '#A0ADCC',
  linkColor: '#A9C0FF',
  inputBackgroundColor: '#0C1430',
  inputTextColor: '#EDF1FF',
  placeholderColor: '#8C9AC0',
  sendButtonColor: '#4A5FE0',
  iconColor: '#A9C0FF',
  replyPreviewColor: '#1C2A57',
  borderColor: '#2C3F80',
  glowColor: '#698BFF',
});

/* AP — All Titans x Eren */
const ALL_TITANS = palette({
  backgroundColor: '#321A12',
  backgroundOverlayColor: 'rgba(50,26,18,0.40)',
  outgoingBubbleColor: '#C95A28',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#40231A',
  incomingTextColor: '#FBEDE7',
  accentColor: '#FF7545',
  secondaryAccentColor: '#E0A16A',
  timestampColor: '#CBA39A',
  linkColor: '#FFB189',
  inputBackgroundColor: '#23110C',
  inputTextColor: '#FBEDE7',
  placeholderColor: '#BE9A8F',
  sendButtonColor: '#D4602C',
  iconColor: '#FFB189',
  replyPreviewColor: '#4E2918',
  borderColor: '#85401F',
  glowColor: '#FF6A38',
});

/* AQ — Armin */
const ARMIN = palette({
  backgroundColor: '#1A2B2B',
  backgroundOverlayColor: 'rgba(26,43,43,0.42)',
  outgoingBubbleColor: '#2E8C7E',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#21393A',
  incomingTextColor: '#EAF9F5',
  accentColor: '#79D6C4',
  secondaryAccentColor: '#A8C6B4',
  timestampColor: '#A3C4BD',
  linkColor: '#9BECD9',
  inputBackgroundColor: '#132020',
  inputTextColor: '#EAF9F5',
  placeholderColor: '#8FB3AC',
  sendButtonColor: '#35A08F',
  iconColor: '#9BECD9',
  replyPreviewColor: '#294544',
  borderColor: '#356B62',
  glowColor: '#79D6C4',
});

/* AR — Levi Ackerman */
const LEVI = palette({
  backgroundColor: '#17211E',
  backgroundOverlayColor: 'rgba(23,33,30,0.42)',
  outgoingBubbleColor: '#3E5E4E',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#202D29',
  incomingTextColor: '#EEF4F0',
  accentColor: '#A8C6B4',
  secondaryAccentColor: '#7C9C87',
  timestampColor: '#A9B8AF',
  linkColor: '#C3DFCE',
  inputBackgroundColor: '#111A17',
  inputTextColor: '#EEF4F0',
  placeholderColor: '#93A69B',
  sendButtonColor: '#4A6E5C',
  iconColor: '#C3DFCE',
  replyPreviewColor: '#29382F',
  borderColor: '#466053',
  glowColor: '#8FBCA5',
});

/* AS — Mikasa Ackerman */
const MIKASA = palette({
  backgroundColor: '#30191D',
  backgroundOverlayColor: 'rgba(48,25,29,0.40)',
  outgoingBubbleColor: '#B53A45',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#3C2025',
  incomingTextColor: '#FBECEE',
  accentColor: '#D94B56',
  secondaryAccentColor: '#9A7A80',
  timestampColor: '#C79FA4',
  linkColor: '#F0939B',
  inputBackgroundColor: '#200F12',
  inputTextColor: '#FBECEE',
  placeholderColor: '#B99499',
  sendButtonColor: '#C6424E',
  iconColor: '#F0939B',
  replyPreviewColor: '#4A2429',
  borderColor: '#7E343C',
  glowColor: '#D94B56',
});

/* AT — Eren Long Hair Titan */
const EREN_LONG_HAIR = palette({
  backgroundColor: '#25140F',
  backgroundOverlayColor: 'rgba(37,20,15,0.40)',
  outgoingBubbleColor: '#C8622F',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#332019',
  incomingTextColor: '#FBEDE6',
  accentColor: '#E97543',
  secondaryAccentColor: '#8C5A3C',
  timestampColor: '#C9A091',
  linkColor: '#FFA176',
  inputBackgroundColor: '#1A0D09',
  inputTextColor: '#FBEDE6',
  placeholderColor: '#BB9182',
  sendButtonColor: '#D16A34',
  iconColor: '#FFA176',
  replyPreviewColor: '#40251A',
  borderColor: '#7A4023',
  glowColor: '#E97543',
});

/* AU — Goku MUI x Jiren */
const GOKU_MUI_JIREN = palette({
  backgroundColor: '#101D35',
  backgroundOverlayColor: 'rgba(16,29,53,0.40)',
  outgoingBubbleColor: '#4A6FE0',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#182647',
  incomingTextColor: '#EEF4FF',
  accentColor: '#B7D8FF',
  secondaryAccentColor: '#C9A227',
  timestampColor: '#A6B7D1',
  linkColor: '#CDE5FF',
  inputBackgroundColor: '#0B1730',
  inputTextColor: '#EEF4FF',
  placeholderColor: '#93A7C4',
  sendButtonColor: '#567BE8',
  iconColor: '#CDE5FF',
  replyPreviewColor: '#1B2B55',
  borderColor: '#2C4A85',
  glowColor: '#B7D8FF',
});

/* AV — Gojo x Sukuna */
const GOJO_X_SUKUNA = palette({
  backgroundColor: '#21102F',
  backgroundOverlayColor: 'rgba(33,16,47,0.42)',
  outgoingBubbleColor: '#7C3AED',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#2B1533',
  incomingTextColor: '#F6EFFF',
  accentColor: '#A678FF',
  secondaryAccentColor: '#FF5267',
  timestampColor: '#BFA0CF',
  linkColor: '#C9A5FF',
  inputBackgroundColor: '#170A22',
  inputTextColor: '#F6EFFF',
  placeholderColor: '#A98CBC',
  sendButtonColor: '#8B4DF0',
  iconColor: '#C9A5FF',
  replyPreviewColor: '#3A1C47',
  borderColor: '#6A3A8C',
  glowColor: '#A678FF',
});

/* AW — Inumaki */
const INUMAKI = palette({
  backgroundColor: '#172335',
  backgroundOverlayColor: 'rgba(23,35,53,0.42)',
  outgoingBubbleColor: '#4A6E9E',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#1F2E42',
  incomingTextColor: '#F0F6FF',
  accentColor: '#B5D9F5',
  secondaryAccentColor: '#8AA6C9',
  timestampColor: '#A6B6CC',
  linkColor: '#CDE8FF',
  inputBackgroundColor: '#111A28',
  inputTextColor: '#F0F6FF',
  placeholderColor: '#93A6BD',
  sendButtonColor: '#587FB0',
  iconColor: '#CDE8FF',
  replyPreviewColor: '#25374F',
  borderColor: '#37506F',
  glowColor: '#B5D9F5',
});

/* AX — Panda */
const PANDA = palette({
  backgroundColor: '#202020',
  backgroundOverlayColor: 'rgba(32,32,32,0.40)',
  outgoingBubbleColor: '#6E6E6E',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#2B2B2B',
  incomingTextColor: '#F5F5F5',
  accentColor: '#D8D8D8',
  secondaryAccentColor: '#A0A0A0',
  timestampColor: '#B0B0B0',
  linkColor: '#E6E6E6',
  inputBackgroundColor: '#171717',
  inputTextColor: '#F5F5F5',
  placeholderColor: '#9A9A9A',
  sendButtonColor: '#7A7A7A',
  iconColor: '#E6E6E6',
  replyPreviewColor: '#333333',
  borderColor: '#4D4D4D',
  glowColor: '#C0C0C0',
});

/* AY — Megumi Fushiguro */
const MEGUMI = palette({
  backgroundColor: '#111C32',
  backgroundOverlayColor: 'rgba(17,28,50,0.40)',
  outgoingBubbleColor: '#3352A8',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#182641',
  incomingTextColor: '#EDF2FF',
  accentColor: '#718BDB',
  secondaryAccentColor: '#4A5FA0',
  timestampColor: '#A2AECB',
  linkColor: '#A9BFFF',
  inputBackgroundColor: '#0C1428',
  inputTextColor: '#EDF2FF',
  placeholderColor: '#8E9CBC',
  sendButtonColor: '#3F5CB8',
  iconColor: '#A9BFFF',
  replyPreviewColor: '#1B2B4D',
  borderColor: '#2E4380',
  glowColor: '#718BDB',
});

/* AZ — Kento Nanami */
const NANAMI = palette({
  backgroundColor: '#2B2417',
  backgroundOverlayColor: 'rgba(43,36,23,0.42)',
  outgoingBubbleColor: '#B08A3E',
  outgoingTextColor: '#1A1408',
  incomingBubbleColor: '#352D1D',
  incomingTextColor: '#FBF5E6',
  accentColor: '#D7B66D',
  secondaryAccentColor: '#8C7A45',
  timestampColor: '#C7B68E',
  linkColor: '#EAD193',
  inputBackgroundColor: '#1F1A0F',
  inputTextColor: '#FBF5E6',
  placeholderColor: '#B7A87E',
  sendButtonColor: '#C29A45',
  iconColor: '#EAD193',
  replyPreviewColor: '#453A22',
  borderColor: '#7A6836',
  glowColor: '#D7B66D',
});

/* BA — Maki Zenin */
const MAKI = palette({
  backgroundColor: '#172A23',
  backgroundOverlayColor: 'rgba(23,42,35,0.40)',
  outgoingBubbleColor: '#2F8C63',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#1F3A30',
  incomingTextColor: '#EAF8F0',
  accentColor: '#64C89A',
  secondaryAccentColor: '#8FD8B8',
  timestampColor: '#A3C4B2',
  linkColor: '#9BE6BE',
  inputBackgroundColor: '#111F1A',
  inputTextColor: '#EAF8F0',
  placeholderColor: '#8FB3A3',
  sendButtonColor: '#3AA06F',
  iconColor: '#9BE6BE',
  replyPreviewColor: '#26493B',
  borderColor: '#357055',
  glowColor: '#64C89A',
});

/* BB — Nobara Kugisaki */
const NOBARA = palette({
  backgroundColor: '#341C27',
  backgroundOverlayColor: 'rgba(52,28,39,0.40)',
  outgoingBubbleColor: '#C94A72',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#42242F',
  incomingTextColor: '#FCECF1',
  accentColor: '#FF789C',
  secondaryAccentColor: '#B05A78',
  timestampColor: '#CDA3B1',
  linkColor: '#FFA6C2',
  inputBackgroundColor: '#24111A',
  inputTextColor: '#FCECF1',
  placeholderColor: '#C097A6',
  sendButtonColor: '#D6547C',
  iconColor: '#FFA6C2',
  replyPreviewColor: '#502B38',
  borderColor: '#83405A',
  glowColor: '#FF789C',
});

/* BC — Geto */
const GETO = palette({
  backgroundColor: '#20152B',
  backgroundOverlayColor: 'rgba(32,21,43,0.42)',
  outgoingBubbleColor: '#7A4FA8',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#2C1E3A',
  incomingTextColor: '#F4EEFB',
  accentColor: '#B08BD8',
  secondaryAccentColor: '#6A4A96',
  timestampColor: '#B6A2C6',
  linkColor: '#D2B8F0',
  inputBackgroundColor: '#170F20',
  inputTextColor: '#F4EEFB',
  placeholderColor: '#A793B6',
  sendButtonColor: '#8A5CB8',
  iconColor: '#D2B8F0',
  replyPreviewColor: '#392648',
  borderColor: '#5F3F86',
  glowColor: '#B08BD8',
});

/* BD — Gojo Red Blue */
const GOJO_RED_BLUE = palette({
  backgroundColor: '#141C3D',
  backgroundOverlayColor: 'rgba(20,28,61,0.40)',
  outgoingBubbleColor: '#2E6FD6',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#1B2547',
  incomingTextColor: '#EBF2FF',
  accentColor: '#4BA8FF',
  secondaryAccentColor: '#FF5267',
  timestampColor: '#A2B2D0',
  linkColor: '#8CCBFF',
  inputBackgroundColor: '#0E1530',
  inputTextColor: '#EBF2FF',
  placeholderColor: '#8EA0C2',
  sendButtonColor: '#3A86F0',
  iconColor: '#8CCBFF',
  replyPreviewColor: '#1F2C57',
  borderColor: '#2C4685',
  glowColor: '#4BA8FF',
});

/* BE — Gojo Hollow Purple */
const GOJO_HOLLOW_PURPLE = palette({
  backgroundColor: '#201033',
  backgroundOverlayColor: 'rgba(32,16,51,0.40)',
  outgoingBubbleColor: '#8B5CF6',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#2B1A42',
  incomingTextColor: '#F5EEFF',
  accentColor: '#B78CFF',
  secondaryAccentColor: '#E0A6FF',
  timestampColor: '#B79FCF',
  linkColor: '#D2B0FF',
  inputBackgroundColor: '#170B24',
  inputTextColor: '#F5EEFF',
  placeholderColor: '#A68CBC',
  sendButtonColor: '#9B6CF6',
  iconColor: '#D2B0FF',
  replyPreviewColor: '#371C50',
  borderColor: '#63409A',
  glowColor: '#B78CFF',
});

/* King X default — no wallpaper, the safe fallback look */
export const DEFAULT_THEME_ID = 'default';
const KINGX_DEFAULT = palette({
  backgroundColor: '#080808',
  backgroundOverlayColor: 'rgba(8,8,8,0.30)',
  outgoingBubbleColor: '#E11D2A',
  outgoingTextColor: '#FFFFFF',
  incomingBubbleColor: '#171717',
  incomingTextColor: '#F5F5F5',
  accentColor: '#E11D2A',
  secondaryAccentColor: '#FF4D5A',
  timestampColor: '#8F8F8F',
  linkColor: '#FF6B75',
  inputBackgroundColor: '#1F1F1F',
  inputTextColor: '#FFFFFF',
  placeholderColor: '#6B6B6B',
  sendButtonColor: '#E11D2A',
  iconColor: '#FFFFFF',
  replyPreviewColor: '#2A0F12',
  borderColor: '#292929',
  glowColor: '#E11D2A',
});

/* ---------- wallpaper inventory ----------
 * 57 unique wallpapers. Every Storage object is registered exactly once and
 * every id is unique. Filenames are kept byte-for-byte (including the original
 * "obisidian.webp" and "vegeta-ulta-2-db.webp" spellings).
 */

const WALLPAPERS = [
  { id: 'goku-ultra-2-db', name: 'Goku Ultra Instinct', category: 'Dragon Ball', file: 'goku-ultra-2-db.webp', palette: ULTRA_INSTINCT },
  { id: 'awaken-gohan-db', name: 'Beast Gohan', category: 'Dragon Ball', file: 'awaken-gohan-db.webp', palette: BEAST_GOHAN },
  { id: 'beerus-db', name: 'Beerus', category: 'Dragon Ball', file: 'beerus-db.webp', palette: BEERUS },
  { id: 'beru-sl', name: 'Beru', category: 'Solo Leveling', file: 'beru-sl.webp', palette: BERU },
  { id: 'cave-blue', name: 'Crystal Ice Cave', category: 'Nature', file: 'cave-blue.webp', palette: ICE_CAVE },
  { id: 'cha-hae-sl', name: 'Cha Hae-In', category: 'Solo Leveling', file: 'cha-hae-sl.webp', palette: CHA_HAE_IN },
  { id: 'couple', name: 'Sakura Romance', category: 'Romance', file: 'couple.webp', palette: COUPLE },
  { id: 'doraemon', name: 'Doraemon', category: 'Other', file: 'doraemon.webp', palette: DORAEMON },
  { id: 'eren-titan-aot', name: 'Attack Titan', category: 'Attack on Titan', file: 'eren-titan-aot.webp', palette: ATTACK_TITAN },
  { id: 'erwin-aot', name: 'Wings of Freedom', category: 'Attack on Titan', file: 'erwin-aot.webp', palette: ERWIN },
  { id: 'galaxy', name: 'Galaxy', category: 'Space and Mystery', file: 'galaxy.webp', palette: GALAXY },
  { id: 'goku-ultra', name: 'Ultra Instinct', category: 'Dragon Ball', file: 'goku-ultra-db.webp', palette: ULTRA_INSTINCT },
  { id: 'hinata-n', name: 'Hinata Hyuga', category: 'Naruto', file: 'hinata-n.webp', palette: HINATA },
  { id: 'itachi-n', name: 'Itachi Uchiha', category: 'Naruto', file: 'itachi-n.webp', palette: ITACHI },
  { id: 'jellyfish-blue', name: 'Bioluminescent Jellyfish', category: 'Nature', file: 'jellyfish-blue.webp', palette: JELLYFISH },
  { id: 'jinha-sl', name: 'Jin-Ha', category: 'Solo Leveling', file: 'jinha-sl.webp', palette: CHA_HAE_IN },
  { id: 'jinwoo-sl', name: 'Shadow Monarch', category: 'Solo Leveling', file: 'jinwoo-sl.webp', palette: SHADOW_MONARCH },
  { id: 'lava', name: 'Inferno', category: 'Other', file: 'lava.webp', palette: LAVA },
  { id: 'madara-n', name: 'Madara Uchiha', category: 'Naruto', file: 'madara-n.webp', palette: MADARA },
  { id: 'naruto-n', name: 'Nine-Tails Chakra', category: 'Naruto', file: 'naruto-n.webp', palette: NARUTO },
  { id: 'nature', name: 'Nature', category: 'Nature', file: 'nature.webp', palette: NATURE },
  { id: 'obisidian', name: 'Obsidian', category: 'Space and Mystery', file: 'obisidian.webp', palette: OBSIDIAN },
  { id: 'orange-piccolo', name: 'Orange Piccolo', category: 'Dragon Ball', file: 'orange-piccolo.webp', palette: ORANGE_PICCOLO },
  { id: 'purple', name: 'Purple Portal', category: 'Space and Mystery', file: 'purple.webp', palette: PURPLE_PORTAL },
  { id: 'roshi-db', name: 'Master Roshi', category: 'Dragon Ball', file: 'roshi-db.webp', palette: ROSHI },
  { id: 'sukuna-jjk', name: 'Sukuna', category: 'Jujutsu Kaisen', file: 'sukuna-jjk.webp', palette: SUKUNA },
  { id: 'two-hearts', name: 'Neon Hearts', category: 'Romance', file: 'two-hearts.webp', palette: NEON_HEARTS },
  { id: 'unknown-places', name: 'Unknown Places', category: 'Space and Mystery', file: 'unknown-places.webp', palette: UNKNOWN_PLACES },
  { id: 'vegeta-db', name: 'Vegeta', category: 'Dragon Ball', file: 'vegeta-db.webp', palette: VEGETA },
  { id: 'vegeta-ulta-2-db', name: 'Vegeta Ultra Ego', category: 'Dragon Ball', file: 'vegeta-ulta-2-db.webp', palette: ULTRA_EGO },
  { id: 'shinron', name: 'Shinron', category: 'Dragon Ball', file: 'shinron.webp', palette: SHINRON },
  /* anime expansion (26 new; sukuna-jjk already registered above).
   * Filenames are the exact private Storage object names, including the
   * original spellings ("trunks-evil-db.webp", "friezza-power-db.webp",
   * "megumi-fushigoro-jjk.webp") and any spaces. IDs stay stable. */
  { id: 'gotenks-db', name: 'Gotenks', category: 'Dragon Ball', file: 'gotenks-db.webp', palette: GOTENKS },
  { id: 'goku-ssj-god-db', name: 'Goku SSJ God', category: 'Dragon Ball', file: 'goku-ssj-god-db.webp', palette: GOKU_SSJ_GOD },
  { id: 'goku-black-ssj-rose-db', name: 'Goku Black SSJ Rose', category: 'Dragon Ball', file: 'goku-black-ssj-rose-db.webp', palette: GOKU_BLACK },
  { id: 'gogeta-ssj-blue-db', name: 'Gogeta SSJ Blue', category: 'Dragon Ball', file: 'gogeta-ssj-blue-db.webp', palette: GOGETA_BLUE },
  { id: 'evil-trunks-db', name: 'Evil Trunks', category: 'Dragon Ball', file: 'trunks-evil-db.webp', palette: EVIL_TRUNKS },
  { id: 'gojo-jjk', name: 'Gojo', category: 'Jujutsu Kaisen', file: 'gojo-jjk.webp', palette: GOJO },
  { id: 'goku-ssj4-db', name: 'Goku SSJ4', category: 'Dragon Ball', file: 'goku-ssj-4-db.webp', palette: GOKU_SSJ4 },
  { id: 'frieza-power-db', name: 'Frieza Power', category: 'Dragon Ball', file: 'friezza-power-db.webp', palette: FRIEZA },
  { id: 'obito-n', name: 'Obito', category: 'Naruto', file: 'obito-n.webp', palette: OBITO },
  { id: 'sasuke-n', name: 'Sasuke', category: 'Naruto', file: 'sasuke-n.webp', palette: SASUKE },
  { id: 'all-titans-x-eren-aot', name: 'All Titans x Eren', category: 'Attack on Titan', file: 'all-titans x eren - aot.webp', palette: ALL_TITANS },
  { id: 'armin-aot', name: 'Armin', category: 'Attack on Titan', file: 'armin-aot.webp', palette: ARMIN },
  { id: 'levi-ackerman-aot', name: 'Levi Ackerman', category: 'Attack on Titan', file: 'levi-ackerman-aot.webp', palette: LEVI },
  { id: 'mikasa-ackerman-aot', name: 'Mikasa Ackerman', category: 'Attack on Titan', file: 'mikasa-ackerman-aot.webp', palette: MIKASA },
  { id: 'eren-long-hair-titan-aot', name: 'Eren — Long Hair Titan', category: 'Attack on Titan', file: 'eren-long-hair-titans-aot.webp', palette: EREN_LONG_HAIR },
  { id: 'goku-mui-x-jiren-db', name: 'Goku MUI x Jiren', category: 'Dragon Ball', file: 'goku-mui-jiren-db.webp', palette: GOKU_MUI_JIREN },
  { id: 'gojo-x-sukuna-jjk', name: 'Gojo x Sukuna', category: 'Jujutsu Kaisen', file: 'gojo x sukuna-jjk.webp', palette: GOJO_X_SUKUNA },
  { id: 'inumaki-jjk', name: 'Inumaki', category: 'Jujutsu Kaisen', file: 'inumaki-jjk.webp', palette: INUMAKI },
  { id: 'panda-jjk', name: 'Panda', category: 'Jujutsu Kaisen', file: 'panda-jjk.webp', palette: PANDA },
  { id: 'megumi-fushiguro-jjk', name: 'Megumi Fushiguro', category: 'Jujutsu Kaisen', file: 'megumi-fushigoro-jjk.webp', palette: MEGUMI },
  { id: 'kento-nanami-jjk', name: 'Kento Nanami', category: 'Jujutsu Kaisen', file: 'kento-nanami-jjk.webp', palette: NANAMI },
  { id: 'maki-zenin-jjk', name: 'Maki Zenin', category: 'Jujutsu Kaisen', file: 'maki-zenin-jjk.webp', palette: MAKI },
  { id: 'nobara-kugisaki-jjk', name: 'Nobara Kugisaki', category: 'Jujutsu Kaisen', file: 'nobara-kugisaki-jjk.webp', palette: NOBARA },
  { id: 'geto-jjk', name: 'Geto', category: 'Jujutsu Kaisen', file: 'geto-jjk.webp', palette: GETO },
  { id: 'gojo-red-blue-jjk', name: 'Gojo: Red and Blue', category: 'Jujutsu Kaisen', file: 'gojo-red-blue-jjk.webp', palette: GOJO_RED_BLUE },
  { id: 'gojo-hollow-purple-jjk', name: 'Gojo: Hollow Purple', category: 'Jujutsu Kaisen', file: 'gojo-hollow-purple-jjk.webp', palette: GOJO_HOLLOW_PURPLE },
];

const DEFAULT_THEME = {
  id: DEFAULT_THEME_ID,
  name: 'King X Default',
  category: 'Other',
  file: null,
  palette: KINGX_DEFAULT,
};

const buildTheme = (entry) => ({
  id: entry.id,
  name: entry.name,
  category: entry.category,
  // No public URL: the private bucket is only ever reached through the
  // authenticated signed-URL store, keyed by this theme's `id`.
  wallpaperUrl: null,
  ...entry.palette,
});

/** The full registry, including the no-wallpaper default. */
export const THEMES = [buildTheme(DEFAULT_THEME), ...WALLPAPERS.map(buildTheme)];

const THEME_MAP = THEMES.reduce((acc, t) => {
  acc[t.id] = t;
  return acc;
}, {});

/**
 * Old team ids that shipped before the wallpaper system — mapped to their
 * closest new theme so a saved preference keeps working.
 */
const LEGACY_ALIASES = {
  obsidian: 'obisidian',
  ultraego: 'vegeta-ulta-2-db',
  inferno: 'lava',
  shenron: 'shinron',
};

export const resolveThemeId = (id) => {
  if (id && THEME_MAP[id]) return id;
  if (id && LEGACY_ALIASES[id]) return LEGACY_ALIASES[id];
  return DEFAULT_THEME_ID;
};

export const findTheme = (id) => THEME_MAP[resolveThemeId(id)];

/**
 * Returns the theme plus every derived colour the chat UI needs. Always
 * resolves to a safe theme, so a missing / unknown id can never break a screen.
 */
export const getTheme = (id) => {
  const base = findTheme(id);
  const incomingText = base.incomingTextColor || onColor(base.incomingBubbleColor, '#FFFFFF');
  const outgoingText = base.outgoingTextColor || onColor(base.outgoingBubbleColor, '#FFFFFF');
  const accentText = onColor(base.accentColor, '#FFFFFF');
  const sendText = onColor(base.sendButtonColor || base.accentColor, '#FFFFFF');
  const replyText = onColor(base.replyPreviewColor || base.incomingBubbleColor, '#FFFFFF');

  return {
    ...base,
    /* legacy / derived aliases used across the chat UI */
    bg: base.backgroundColor,
    image: base.wallpaperUrl,
    you: base.outgoingBubbleColor,
    other: base.incomingBubbleColor,
    text: incomingText,
    youText: outgoingText,
    header: mix(base.backgroundColor, '#000000', 0.45),
    panel: base.inputBackgroundColor,
    line: base.borderColor,
    elevated: mix(base.backgroundColor, '#FFFFFF', 0.09),
    accentText,
    sendText,
    replyText,
    headerTextColor: mix('#FFFFFF', base.accentColor, 0.06),
  };
};

/** Category list for the picker filters. */
export const THEME_CATEGORIES = [
  'All',
  'Dragon Ball',
  'Naruto',
  'Solo Leveling',
  'Jujutsu Kaisen',
  'Attack on Titan',
  'Nature',
  'Space and Mystery',
  'Romance',
  'Other',
];
