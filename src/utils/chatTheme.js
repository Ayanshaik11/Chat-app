/*
 * King X — chat wallpaper + colour theme registry.
 *
 * This is the single source of truth for every chat wallpaper and its palette.
 * Nothing here makes a network request: the whole registry is bundled with the
 * app. Wallpaper bitmaps are the only remote assets (Supabase public storage).
 *
 * Adding a wallpaper later:
 *   1. add its palette constant below (or reuse one), and
 *   2. add one entry to WALLPAPERS with a unique `id`, `file` and `palette`.
 * `getTheme()` picks it up automatically and the picker shows it.
 */

export const WALLPAPER_BUCKET =
  'https://uefhqvdtfhnzzrmhjzov.supabase.co/storage/v1/object/public/chat-wallpapers/';

const wp = (file) => `${WALLPAPER_BUCKET}${file}`;

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
 * 31 unique wallpapers. Every Storage object is registered exactly once and
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
  wallpaperUrl: entry.file ? wp(entry.file) : null,
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

/**
 * Small Supabase render URL used for picker thumbnails, so the grid never
 * downloads a full-resolution wallpaper just to show a card. Falls back to the
 * original URL if the transformation endpoint is unavailable.
 */
export const themeThumbUrl = (url) => {
  if (!url) return null;
  const marker = '/storage/v1/object/public/';
  if (!url.includes(marker)) return url;
  return `${url.replace(marker, '/storage/v1/render/image/public/')}?width=240&height=320&resize=cover&quality=70`;
};
