// King X theme — black + gold, light and dark
export const gradient = ['#F5B700', '#1a1a1a']; // gold -> near-black
export const gradientProps = { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } };

export const lightColors = {
  bg: '#FFFFFF',
  card: '#FFFFFF',
  text: '#141414',
  subtext: '#6B6B6B',
  border: '#E8E8E8',
  primary: '#B98600',     // readable gold on light backgrounds
  accent: '#141414',
  inputBg: '#F2F2F2',     // neutral grey, not cream — gold stays an accent, not a tint
  bubbleMine: '#F5C542',  // dark-ish gold
  bubbleMineText: '#1A1200',
  bubbleOther: '#F2F2F2',
  tabBar: '#FFFFFF',
  danger: '#E5484D',
  online: '#22C55E',
  overlay: 'rgba(0,0,0,0.5)',
};

export const darkColors = {
  bg: '#161616',          // extra grey, matching the phone-mockup background
  card: '#1E1E1E',
  text: '#F5EFDD',
  subtext: '#A79B7D',
  border: '#333333',
  primary: '#F5B700',
  accent: '#F5EFDD',
  inputBg: '#242424',
  bubbleMine: '#C99400',  // dark gold
  bubbleMineText: '#0A0800',
  bubbleOther: '#262626',
  tabBar: '#141414',
  danger: '#FF6B6B',
  online: '#34D399',
  overlay: 'rgba(0,0,0,0.65)',
};

export const fonts = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
  logo: 'BebasNeue_400Regular',
};
