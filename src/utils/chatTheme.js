/*
 * King X — chat wallpaper + colour theme registry.
 *
 * This is the single source of truth for every chat wallpaper and its palette.
 * Nothing here makes a network request: the whole registry is bundled with the
 * app. Wallpaper bitmaps are the only remote assets, and they are served from
 * the private Supabase bucket through short-lived signed URLs minted by the
 * authenticated `/api/wallpapers` endpoint (keyed by theme `id`).
 *
 * Every wallpaper entry is defined by the five colours supplied for its
 * character/wallpaper palette (background, surface, primary, accent, text).
 * The rest of the UI colour slots are derived from those five values so the
 * whole chat renderer stays consistent.
 *
 * Adding a wallpaper later:
 *   1. add one entry to WALLPAPERS with the exact Storage filename as `file`
 *      and the same value (without ".webp") as `id`, and
 *   2. mirror that id/file pair in Proxy-API/lib/wallpaperRegistry.js.
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
export const onColor = (bg, light = '#FFFFFF', threshold = 0.62) => {
  const [r, g, b] = rgb(bg);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > threshold ? '#04121A' : light;
};

const relativeLuminance = (hex) => {
  const channels = rgb(hex).map((value) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

const contrastRatio = (a, b) => {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

/** Prefer the supplied text, but fall back to white/black when it reads better. */
const readableOn = (bg, preferred = '#FFFFFF') => {
  const options = [preferred, '#FFFFFF', '#000000'];
  return options.reduce((best, candidate) => (
    contrastRatio(bg, candidate) > contrastRatio(bg, best) ? candidate : best
  ), preferred);
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

/**
 * Build the complete chat palette from one supplied five-colour palette.
 * The supplied HEX values are used verbatim for the main UI surfaces; only
 * secondary slots (timestamps, placeholders, borders, reply previews) are
 * derived from them, and text on primary-coloured controls is chosen for
 * contrast without altering the palette itself.
 */
const paletteFrom = (background, surface, primary, accent, text) => palette({
  /* supplied palette */
  background,
  surface,
  primary,
  accent,
  text,

  /* renderer slots */
  backgroundColor: background,
  backgroundOverlayColor: rgba(background, 0.42),
  outgoingBubbleColor: primary,
  outgoingTextColor: readableOn(primary, text),
  incomingBubbleColor: surface,
  incomingTextColor: text,
  accentColor: accent,
  secondaryAccentColor: accent,
  timestampColor: mix(text, background, 0.38),
  linkColor: accent,
  inputBackgroundColor: surface,
  inputTextColor: text,
  placeholderColor: mix(text, surface, 0.48),
  sendButtonColor: primary,
  iconColor: accent,
  replyPreviewColor: mix(surface, background, 0.35),
  borderColor: mix(surface, accent, 0.35),
  glowColor: primary,
  statusColor: accent,
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
 * 83 wallpapers, one for every object supplied from the private
 * "chat-wallpapers" bucket. `file` is the authoritative Storage object name;
 * `id` is that filename without ".webp" and is also the signed-URL cache key.
 * Display names stay separate from storage filenames.
 *
 * Categories: Dragon Ball, Naruto, Attack on Titan, Jujutsu Kaisen, One Piece,
 * Solo Leveling, Doraemon, Nature & Abstract, Couples & General.
 */

const WALLPAPERS = [
  /* ---------- Dragon Ball (34) ---------- */
  { id: '17-x-18-db', name: 'Android 17 & Android 18', category: 'Dragon Ball', file: '17-x-18-db.webp', palette: paletteFrom('#10151B', '#252D35', '#42C8A5', '#E7B7C8', '#F5F7FA') },
  { id: 'awaken-gohan-db', name: 'Gohan — Beast', category: 'Dragon Ball', file: 'awaken-gohan-db.webp', palette: paletteFrom('#180D23', '#302047', '#A95BFA', '#F3D6FF', '#FFFFFF') },
  { id: 'beerus-db', name: 'Beerus', category: 'Dragon Ball', file: 'beerus-db.webp', palette: paletteFrom('#170F2B', '#30204C', '#AD79E8', '#F2C76E', '#F7F0FF') },
  { id: 'bulma-db', name: 'Bulma', category: 'Dragon Ball', file: 'bulma-db.webp', palette: paletteFrom('#101C36', '#253E68', '#55A8FF', '#F47FAE', '#F4F8FF') },
  { id: 'cell-db', name: 'Cell', category: 'Dragon Ball', file: 'cell-db.webp', palette: paletteFrom('#101B12', '#233D27', '#7FAF43', '#D6E97A', '#F3F8E8') },
  { id: 'destroyers-x-angels-db', name: 'Destroyers & Angels', category: 'Dragon Ball', file: 'destroyers-x-angels-db.webp', palette: paletteFrom('#11101F', '#29253D', '#A78BFA', '#F3CF80', '#F7F4FF') },
  { id: 'fat-buu-db', name: 'Majin Buu', category: 'Dragon Ball', file: 'fat-buu-db.webp', palette: paletteFrom('#28122E', '#51245B', '#E78ACF', '#F4D58A', '#FFF4FC') },
  { id: 'frieza-base-db', name: 'Frieza — Base Form', category: 'Dragon Ball', file: 'frieza-base-db.webp', palette: paletteFrom('#180F2A', '#32204D', '#B99AFF', '#E9B5EF', '#FFFFFF') },
  { id: 'frieza-black-db', name: 'Frieza Black', category: 'Dragon Ball', file: 'frieza-black-db.webp', palette: paletteFrom('#0B0B10', '#20202B', '#777784', '#D7D7E2', '#FFFFFF') },
  { id: 'frieza-golden-db', name: 'Golden Frieza', category: 'Dragon Ball', file: 'frieza-golden-db.webp', palette: paletteFrom('#211506', '#49300D', '#F4C542', '#FFF0A6', '#FFF9E8') },
  { id: 'gogeta-ssj-blue-db', name: 'Gogeta — Super Saiyan Blue', category: 'Dragon Ball', file: 'gogeta-ssj-blue-db.webp', palette: paletteFrom('#07172C', '#142E52', '#238BFF', '#65E7FF', '#F0FCFF') },
  { id: 'goku-black-db', name: 'Goku Black', category: 'Dragon Ball', file: 'goku-black-db.webp', palette: paletteFrom('#160D1D', '#302038', '#C75A82', '#E7B4D0', '#FFF5FA') },
  { id: 'goku-black-ssj-rose-db', name: 'Goku Black — Super Saiyan Rosé', category: 'Dragon Ball', file: 'goku-black-ssj-rose-db.webp', palette: paletteFrom('#1A0B20', '#3A1644', '#F04FB8', '#B78BFF', '#FFF3FC') },
  { id: 'goku-ssj-4-db', name: 'Goku — Super Saiyan 4', category: 'Dragon Ball', file: 'goku-ssj-4-db.webp', palette: paletteFrom('#1D0D0B', '#44201A', '#D83E36', '#F1B56B', '#FFF1E5') },
  { id: 'goku-ssj-blue-db', name: 'Goku — Super Saiyan Blue', category: 'Dragon Ball', file: 'goku-ssj-blue-db.webp', palette: paletteFrom('#07172A', '#173454', '#268AFF', '#69E5FF', '#F3FCFF') },
  { id: 'goku-ssj-god-db', name: 'Goku — Super Saiyan God', category: 'Dragon Ball', file: 'goku-ssj-god-db.webp', palette: paletteFrom('#200D17', '#46182A', '#F04B62', '#FFB0A0', '#FFF4F0') },
  { id: 'goku-ultra-db', name: 'Goku — Ultra Instinct', category: 'Dragon Ball', file: 'goku-ultra-db.webp', palette: paletteFrom('#10172B', '#202F4C', '#A8C9FF', '#E5EFFF', '#FFFFFF') },
  { id: 'goku-ultra-stand', name: 'Goku — Ultra Instinct (Stand)', category: 'Dragon Ball', file: 'goku-ultra-stand.webp', palette: paletteFrom('#10172B', '#202F4C', '#A8C9FF', '#E5EFFF', '#FFFFFF') },
  { id: 'goku-x-jiren-db', name: 'Goku & Jiren', category: 'Dragon Ball', file: 'goku-x-jiren-db.webp', palette: paletteFrom('#17101C', '#33213A', '#E85B55', '#8D7CFF', '#FFF5F4') },
  { id: 'gotenks-db', name: 'Gotenks', category: 'Dragon Ball', file: 'gotenks-db.webp', palette: paletteFrom('#21122D', '#42204E', '#B56CFF', '#F5D75E', '#FFF8FF') },
  { id: 'jiren-db', name: 'Jiren', category: 'Dragon Ball', file: 'jiren-db.webp', palette: paletteFrom('#170F19', '#34202B', '#D94D5D', '#F1A2A9', '#FFF5F5') },
  { id: 'kid-buu-db', name: 'Kid Buu', category: 'Dragon Ball', file: 'kid-buu-db.webp', palette: paletteFrom('#25102D', '#481B53', '#D45BDA', '#F6A8F0', '#FFF5FF') },
  { id: 'orange-piccolo', name: 'Orange Piccolo', category: 'Dragon Ball', file: 'orange-piccolo.webp', palette: paletteFrom('#1C100B', '#40261A', '#E66C25', '#8CCB70', '#FFF4E8') },
  { id: 'pilaf-team-db', name: 'Pilaf Gang', category: 'Dragon Ball', file: 'pilaf-team-db.webp', palette: paletteFrom('#17162B', '#302A4B', '#8577D8', '#E9C46A', '#FFF8EA') },
  { id: 'roshi-db', name: 'Master Roshi', category: 'Dragon Ball', file: 'roshi-db.webp', palette: paletteFrom('#171A20', '#303741', '#B9B6A5', '#D8C98B', '#FAF8EE') },
  { id: 'shenron-db', name: 'Shenron', category: 'Dragon Ball', file: 'shenron-db.webp', palette: paletteFrom('#071A19', '#103B34', '#35A978', '#B7D85A', '#F2FFE9') },
  { id: 'trunks-evil-db', name: 'Evil Trunks', category: 'Dragon Ball', file: 'trunks-evil-db.webp', palette: paletteFrom('#180F20', '#34213E', '#A56BC5', '#E0B6FF', '#FFF5FF') },
  { id: 'vegeta-db', name: 'Vegeta', category: 'Dragon Ball', file: 'vegeta-db.webp', palette: paletteFrom('#101827', '#22334B', '#527CC5', '#C1A4E8', '#F4F6FF') },
  { id: 'vegeta-ssj-blue-db', name: 'Vegeta — Super Saiyan Blue', category: 'Dragon Ball', file: 'vegeta-ssj-blue-db.webp', palette: paletteFrom('#07172C', '#173453', '#2787F5', '#64D9FF', '#F2FCFF') },
  { id: 'vegeta-ssj-god-db', name: 'Vegeta — Super Saiyan God', category: 'Dragon Ball', file: 'vegeta-ssj-god-db.webp', palette: paletteFrom('#200D17', '#46182A', '#ED4A60', '#FFB0A0', '#FFF4F0') },
  { id: 'vegeta-ultra', name: 'Vegeta — Ultra Ego', category: 'Dragon Ball', file: 'vegeta-ultra.webp', palette: paletteFrom('#171022', '#302044', '#925BCE', '#C8B1FF', '#F8F3FF') },
  { id: 'vegito-ssj-blue-db', name: 'Vegito — Super Saiyan Blue', category: 'Dragon Ball', file: 'vegito-ssj-blue-db.webp', palette: paletteFrom('#09182C', '#1B3458', '#287FFF', '#75E4FF', '#F4FCFF') },
  { id: 'zamasu-halo-db', name: 'Zamasu — Halo', category: 'Dragon Ball', file: 'zamasu-halo-db.webp', palette: paletteFrom('#0F1D19', '#213D31', '#7FC9A3', '#D6E9A6', '#F5FFF4') },
  { id: 'zeno-db', name: 'Zeno', category: 'Dragon Ball', file: 'zeno-db.webp', palette: paletteFrom('#17112A', '#30224E', '#A88AFF', '#F1D2FF', '#FFFFFF') },

  /* ---------- Naruto (7) ---------- */
  { id: 'hinata-n', name: 'Hinata Hyuga', category: 'Naruto', file: 'hinata-n.webp', palette: paletteFrom('#19152B', '#30294A', '#9B8CE8', '#F0C4D8', '#FFF6FC') },
  { id: 'itachi-n', name: 'Itachi Uchiha', category: 'Naruto', file: 'itachi-n.webp', palette: paletteFrom('#100D1C', '#272036', '#BA303E', '#B8A0D8', '#F7F1FF') },
  { id: 'kakashi-hatake-n', name: 'Kakashi Hatake', category: 'Naruto', file: 'kakashi-hatake-n.webp', palette: paletteFrom('#101923', '#253747', '#6CA6C9', '#B8D4E8', '#F3F8FC') },
  { id: 'madara-n', name: 'Madara Uchiha', category: 'Naruto', file: 'madara-n.webp', palette: paletteFrom('#160B12', '#35202A', '#A32D42', '#D78C83', '#FFF0EF') },
  { id: 'naruto-n', name: 'Naruto Uzumaki', category: 'Naruto', file: 'naruto-n.webp', palette: paletteFrom('#20120A', '#49301B', '#F28B27', '#FFD15C', '#FFF6E6') },
  { id: 'obito-n', name: 'Obito Uchiha', category: 'Naruto', file: 'obito-n.webp', palette: paletteFrom('#130D19', '#302039', '#8E4D9D', '#C99BCF', '#FFF4FF') },
  { id: 'sasuke-n', name: 'Sasuke Uchiha', category: 'Naruto', file: 'sasuke-n.webp', palette: paletteFrom('#0D1421', '#1D2C44', '#536FD1', '#A9B9FF', '#F4F5FF') },

  /* ---------- Attack on Titan (8) ---------- */
  { id: 'all-titans-x-eren', name: 'All Titans — Eren', category: 'Attack on Titan', file: 'all-titans-x-eren.webp', palette: paletteFrom('#180D0B', '#38201B', '#A43B2C', '#D99A65', '#FFF0DF') },
  { id: 'armin-aot', name: 'Armin Arlert', category: 'Attack on Titan', file: 'armin-aot.webp', palette: paletteFrom('#17232D', '#293B49', '#D8B477', '#7BA9B7', '#F2F5F6') },
  { id: 'eren-long-hair-titans-aot', name: 'Eren — Long Hair Titan', category: 'Attack on Titan', file: 'eren-long-hair-titans-aot.webp', palette: paletteFrom('#1C100E', '#3B211D', '#A64D36', '#C99A76', '#F8EDE5') },
  { id: 'eren-titan-aot', name: 'Eren — Attack Titan', category: 'Attack on Titan', file: 'eren-titan-aot.webp', palette: paletteFrom('#1B100D', '#40231A', '#B94B2D', '#E6A15C', '#FFF0DF') },
  { id: 'eren-x-mikasa-aot', name: 'Eren & Mikasa', category: 'Attack on Titan', file: 'eren-x-mikasa-aot.webp', palette: paletteFrom('#1A1116', '#39212A', '#B94B43', '#D7A58A', '#FFF2EC') },
  { id: 'erwin-aot', name: 'Erwin Smith', category: 'Attack on Titan', file: 'erwin-aot.webp', palette: paletteFrom('#18202A', '#303C49', '#B99A63', '#7996AA', '#F4F5F2') },
  { id: 'levi-ackerman-aot', name: 'Levi Ackerman', category: 'Attack on Titan', file: 'levi-ackerman-aot.webp', palette: paletteFrom('#111A1A', '#263534', '#8FAFA4', '#D8CDB5', '#F7F7F0') },
  { id: 'mikasa-ackerman-aot', name: 'Mikasa Ackerman', category: 'Attack on Titan', file: 'mikasa-ackerman-aot.webp', palette: paletteFrom('#171116', '#34222A', '#A84445', '#CFA49A', '#FFF3EF') },

  /* ---------- Jujutsu Kaisen (16) ---------- */
  { id: 'geto-jjk', name: 'Suguru Geto', category: 'Jujutsu Kaisen', file: 'geto-jjk.webp', palette: paletteFrom('#160F20', '#30203D', '#9062B7', '#D6A4C7', '#F7F0FA') },
  { id: 'gojo-hollow-purple-jjk', name: 'Gojo — Hollow Purple', category: 'Jujutsu Kaisen', file: 'gojo-hollow-purple-jjk.webp', palette: paletteFrom('#100D29', '#28204D', '#985BFF', '#E0B7FF', '#FFFFFF') },
  { id: 'gojo-jjk', name: 'Satoru Gojo', category: 'Jujutsu Kaisen', file: 'gojo-jjk.webp', palette: paletteFrom('#0C182A', '#1C3557', '#4BA7FF', '#A8D9FF', '#F5FBFF') },
  { id: 'gojo-red-blue-jjk', name: 'Gojo — Red & Blue', category: 'Jujutsu Kaisen', file: 'gojo-red-blue-jjk.webp', palette: paletteFrom('#130F28', '#292044', '#F05272', '#438BFF', '#FFFFFF') },
  { id: 'gojo-x-sukuna-jjk', name: 'Gojo & Sukuna', category: 'Jujutsu Kaisen', file: 'gojo-x-sukuna-jjk.webp', palette: paletteFrom('#17101F', '#302039', '#629EFF', '#E95668', '#FFF6F5') },
  { id: 'inumaki-jjk', name: 'Toge Inumaki', category: 'Jujutsu Kaisen', file: 'inumaki-jjk.webp', palette: paletteFrom('#171525', '#302B43', '#A6A4D8', '#E7DDF7', '#FFFFFF') },
  { id: 'kento-nanami-jjk', name: 'Kento Nanami', category: 'Jujutsu Kaisen', file: 'kento-nanami-jjk.webp', palette: paletteFrom('#17221D', '#2C4134', '#C7A75B', '#E5D7A7', '#F8F6EB') },
  { id: 'maki-zenin-jjk', name: 'Maki Zenin', category: 'Jujutsu Kaisen', file: 'maki-zenin-jjk.webp', palette: paletteFrom('#111D1C', '#263B37', '#4DB99C', '#B1D9C9', '#F5FFF9') },
  { id: 'megumi-fushiguro-jjk', name: 'Megumi Fushiguro', category: 'Jujutsu Kaisen', file: 'megumi-fushiguro-jjk.webp', palette: paletteFrom('#0B1420', '#1D2B40', '#5475B8', '#9BB8F0', '#F2F6FF') },
  { id: 'nobara-kugisaki-jjk', name: 'Nobara Kugisaki', category: 'Jujutsu Kaisen', file: 'nobara-kugisaki-jjk.webp', palette: paletteFrom('#21151D', '#45303A', '#D66B8D', '#F0C17D', '#FFF6F4') },
  { id: 'panda-jjk', name: 'Panda', category: 'Jujutsu Kaisen', file: 'panda-jjk.webp', palette: paletteFrom('#11151C', '#282E38', '#8997A8', '#D4DCE5', '#FFFFFF') },
  { id: 'sukuna-domain-jjk', name: 'Sukuna — Domain Expansion', category: 'Jujutsu Kaisen', file: 'sukuna-domain-jjk.webp', palette: paletteFrom('#21090F', '#481522', '#C72F4D', '#FF758A', '#FFF0F2') },
  { id: 'sukuna-jjk', name: 'Ryomen Sukuna', category: 'Jujutsu Kaisen', file: 'sukuna-jjk.webp', palette: paletteFrom('#1C0B12', '#3E1825', '#D64058', '#F29A9F', '#FFF3F2') },
  { id: 'toji-fushiguro', name: 'Toji Fushiguro', category: 'Jujutsu Kaisen', file: 'toji-fushiguro.webp', palette: paletteFrom('#101B1C', '#243637', '#4FA69A', '#B4D6C9', '#F3FCF8') },
  { id: 'yuta-jjk', name: 'Yuta Okkotsu', category: 'Jujutsu Kaisen', file: 'yuta-jjk.webp', palette: paletteFrom('#101A2A', '#24334D', '#7699E8', '#D7E1FF', '#FFFFFF') },

  /* ---------- One Piece (3) ---------- */
  { id: 'luffy-gear-5-op', name: 'Luffy — Gear 5', category: 'One Piece', file: 'luffy-gear-5-op.webp', palette: paletteFrom('#17151E', '#302A3D', '#F5F0DF', '#E75C55', '#FFFFFF') },
  { id: 'roronoa-zoro-op', name: 'Roronoa Zoro', category: 'One Piece', file: 'roronoa-zoro-op.webp', palette: paletteFrom('#101D18', '#203B2D', '#46A66B', '#B5D66D', '#F5F8E9') },
  { id: 'shanks-op', name: 'Shanks', category: 'One Piece', file: 'shanks-op.webp', palette: paletteFrom('#1B0F13', '#3A1D24', '#B52F3C', '#D6A06A', '#FFF0E6') },

  /* ---------- Solo Leveling (4) ---------- */
  { id: 'beru-sl', name: 'Beru', category: 'Solo Leveling', file: 'beru-sl.webp', palette: paletteFrom('#071C19', '#103D32', '#31D6A1', '#A1F8D6', '#F0FFF8') },
  { id: 'cha-hae-in-sl', name: 'Cha Hae-In', category: 'Solo Leveling', file: 'cha-hae-in-sl.webp', palette: paletteFrom('#1A1210', '#2E211A', '#9B2335', '#E3B04B', '#FFF4E2') },
  { id: 'igris-jjk', name: 'Igris', category: 'Solo Leveling', file: 'igris-jjk.webp', palette: paletteFrom('#0D0A0F', '#211A1E', '#7A1F2B', '#D62839', '#FFE8E8') },
  { id: 'jinha-sl', name: 'Jin-Ha', category: 'Solo Leveling', file: 'jinha-sl.webp', palette: paletteFrom('#111C29', '#24394E', '#5DA7CE', '#A7DDF0', '#F3FBFF') },
  { id: 'jinwoo-sl', name: 'Sung Jinwoo', category: 'Solo Leveling', file: 'jinwoo-sl.webp', palette: paletteFrom('#090D1A', '#191F38', '#6259FF', '#A89CFF', '#F6F5FF') },

  /* ---------- Doraemon (1) ---------- */
  { id: 'doraemon', name: 'Doraemon', category: 'Doraemon', file: 'doraemon.webp', palette: paletteFrom('#071E39', '#123C67', '#159FE8', '#F6D447', '#F4FAFF') },

  /* ---------- Nature & Abstract (7) ---------- */
  { id: 'cave-blue', name: 'Crystal Ice Cave', category: 'Nature & Abstract', file: 'cave-blue.webp', palette: paletteFrom('#061322', '#102B46', '#267BC1', '#56D9F5', '#E7F6FF') },
  { id: 'galaxy', name: 'Galaxy', category: 'Nature & Abstract', file: 'galaxy.webp', palette: paletteFrom('#080C20', '#171D40', '#8266FF', '#46D8E8', '#F5F4FF') },
  { id: 'jellyfish-blue', name: 'Bioluminescent Jellyfish', category: 'Nature & Abstract', file: 'jellyfish-blue.webp', palette: paletteFrom('#071B2B', '#103D55', '#36C8F2', '#8AF0FF', '#F0FDFF') },
  { id: 'lava', name: 'Lava', category: 'Nature & Abstract', file: 'lava.webp', palette: paletteFrom('#210906', '#48150C', '#E64B18', '#FFB52E', '#FFF0CF') },
  { id: 'nature', name: 'Nature', category: 'Nature & Abstract', file: 'nature.webp', palette: paletteFrom('#101E16', '#263D2C', '#639B63', '#C0DDA1', '#F4F8EB') },
  { id: 'obsidian', name: 'Obsidian', category: 'Nature & Abstract', file: 'obsidian.webp', palette: paletteFrom('#090B10', '#191D27', '#515C72', '#9BAAC0', '#F3F6FC') },
  { id: 'purple', name: 'Purple', category: 'Nature & Abstract', file: 'purple.webp', palette: paletteFrom('#130D24', '#2C1D49', '#8B5CF6', '#C4B5FD', '#F8F5FF') },

  /* ---------- Couples & General (3) ---------- */
  { id: 'couple', name: 'Couple', category: 'Couples & General', file: 'couple.webp', palette: paletteFrom('#20121F', '#3B2437', '#E98EB4', '#F4C985', '#FFF5F8') },
  { id: 'two-hearts', name: 'Two Hearts', category: 'Couples & General', file: 'two-hearts.webp', palette: paletteFrom('#21121D', '#432438', '#E76D9C', '#F5C0D1', '#FFF6FA') },
  { id: 'unknown-places', name: 'Unknown Places', category: 'Couples & General', file: 'unknown-places.webp', palette: paletteFrom('#101722', '#222F42', '#6486AC', '#B3CBE4', '#F5F8FC') },
];

const DEFAULT_THEME = {
  id: DEFAULT_THEME_ID,
  name: 'King X Default',
  category: 'Couples & General',
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
 * Ids that shipped before the current catalog — mapped to their closest new
 * theme so a saved preference keeps working. Unknown ids still fall back to the
 * default; nothing is silently pointed at the wrong character.
 */
const LEGACY_ALIASES = {
  'goku-ultra-2-db': 'goku-ultra-db',
  'goku-ultra': 'goku-ultra-db',
  'cha-hae-sl': 'cha-hae-in-sl',
  'obisidian': 'obsidian',
  'obsidian': 'obsidian',
  'vegeta-ulta-2-db': 'vegeta-ultra',
  'ultraego': 'vegeta-ultra',
  'shinron': 'shenron-db',
  'shenron': 'shenron-db',
  'inferno': 'lava',
  'evil-trunks-db': 'trunks-evil-db',
  'goku-ssj4-db': 'goku-ssj-4-db',
  'frieza-power-db': 'frieza-base-db',
  'all-titans-x-eren-aot': 'all-titans-x-eren',
  'eren-long-hair-titan-aot': 'eren-long-hair-titans-aot',
  'goku-mui-x-jiren-db': 'goku-x-jiren-db',
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
  const outgoingText = base.outgoingTextColor || readableOn(base.outgoingBubbleColor, '#FFFFFF');
  const accentText = readableOn(base.accentColor, '#FFFFFF');
  const sendText = readableOn(base.sendButtonColor || base.accentColor, '#FFFFFF');
  const replyText = readableOn(base.replyPreviewColor || base.incomingBubbleColor, '#FFFFFF');

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
  'Attack on Titan',
  'Jujutsu Kaisen',
  'One Piece',
  'Solo Leveling',
  'Doraemon',
  'Nature & Abstract',
  'Couples & General',
];
