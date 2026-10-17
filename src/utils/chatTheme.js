const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

// mix colour a towards colour b by t (0..1)
export const mix = (a, b, t) => {
  const A = rgb(a), B = rgb(b);
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
};

// readable text colour on top of a background colour
export const onColor = (bg, light = '#FFFFFF') => {
  const [r, g, b] = rgb(bg);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? '#04121A' : light;
};

// bg = background, you = your bubbles, other = friend's bubbles
export const THEMES = [
  { id: 'default', name: 'King X Red', tag: 'Classic · Bold', bg: '#080808', you: '#E11D2A', other: '#171717', accent: '#E11D2A', text: '#FFFFFF' },
  { id: 'saiyan', name: 'Saiyan Blue', tag: 'Power · Energy · Dragon Ball', bg: '#0A1F44', you: '#1E90FF', other: '#1B2A4A', accent: '#00E5FF', text: '#E6F0FF' },
  { id: 'royal', name: 'Royal King', tag: 'Premium · Elegant · Royal', bg: '#0B0B14', you: '#6C3BFF', other: '#2A1B4D', accent: '#FFD700', text: '#F5E6FF' },
  { id: 'galaxy', name: 'Galaxy X', tag: 'Space · Futuristic · Premium', bg: '#050314', you: '#7B3DFF', other: '#1E1B3F', accent: '#00D4FF', text: '#EDE9FF' },
  { id: 'cyberice', name: 'Cyber Ice', tag: 'Clean · Modern · Futuristic', bg: '#0A2A3A', you: '#00E5FF', other: '#1A3B4D', accent: '#00BCD4', text: '#E6F7FF' },
  { id: 'inferno', name: 'Inferno X', tag: 'Bold · Intense · Powerful', bg: '#0B0B0B', you: '#FF3B30', other: '#2A1A1A', accent: '#FF8A00', text: '#FFFFFF' },
  { id: 'neon', name: 'Neon Purple', tag: 'Modern · Stylish · AI Vibe', bg: '#0A0515', you: '#A855F7', other: '#2B1B43', accent: '#FF00E5', text: '#F5E6FF' },
  { id: 'shenron', name: 'Shenron', tag: 'Mystic · Calm · Legendary', bg: '#051F16', you: '#00C853', other: '#0B3D2E', accent: '#FFD700', text: '#E8FFE9' },
  { id: 'cyberpunk', name: 'Cyberpunk', tag: 'Hacker · Neon · Futuristic', bg: '#0B0B18', you: '#00E5FF', other: '#1A1A2E', accent: '#FF00D4', text: '#E6F0FF' },
  { id: 'obsidian', name: 'Obsidian', tag: 'Minimal · Classy · Premium', bg: '#0A0A0F', you: '#2E3A47', other: '#1A1A1F', accent: '#9CA3AF', text: '#E5E7EB' },
  { id: 'diamond', name: 'Diamond X', tag: 'Clean · Fresh · Professional', bg: '#071A2F', you: '#00B4FF', other: '#133D5C', accent: '#38BDF8', text: '#EAF6FF' },
  { id: 'ultraego', name: 'Ultra Ego', tag: 'Aggressive · Bold · Anime', bg: '#0B0020', you: '#A020F0', other: '#2B1A4D', accent: '#FF2D95', text: '#F3E6FF' },
  { id: 'aicore', name: 'AI Core', tag: 'Smart · Futuristic · Next Gen', bg: '#0A0F1A', you: '#0066FF', other: '#1A2A4A', accent: '#00E5FF', text: '#E6F2FF' },
];

// theme + the extra shades the chat screen needs (header, panels, lines, readable text on your bubbles)
export const getTheme = (id) => {
  const t = THEMES.find((x) => x.id === id) || THEMES[0];
  return {
    ...t,
    header: mix(t.bg, '#000000', 0.35),
    panel: mix(t.bg, '#FFFFFF', 0.09),
    line: mix(t.bg, '#FFFFFF', 0.17),
    youText: onColor(t.you, t.text),
    accentText: onColor(t.accent),
  };
};
