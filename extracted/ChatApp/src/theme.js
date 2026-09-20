// Green -> blue design system. Every screen reads its colours from here,
// so changing a value below restyles the whole app.

const brand = {
  green: "#10b981",
  greenSoft: "#34d399",
  teal: "#0d9488",
  blue: "#0ea5e9",
  blueDeep: "#0369a1"
};

export const gradients = {
  primary: [brand.green, brand.blue],
  primarySoft: [brand.greenSoft, "#38bdf8"],
  story: ["#34d399", "#0ea5e9", "#6366f1"],
  danger: ["#f43f5e", "#fb7185"]
};

const dark = {
  mode: "dark",
  bg: "#0b1416",
  surface: "#121d20",
  surfaceAlt: "#18272b",
  border: "rgba(255,255,255,0.09)",
  text: "#ecfdf5",
  muted: "rgba(236,253,245,0.55)",
  faint: "rgba(236,253,245,0.3)",
  primary: brand.green,
  primaryText: "#04211a",
  accent: brand.blue,
  bubbleMine: brand.teal,
  bubbleTheirs: "#1c2f34",
  danger: "#fb7185",
  success: brand.greenSoft,
  overlay: "rgba(0,0,0,0.6)"
};

const light = {
  mode: "light",
  bg: "#f3faf8",
  surface: "#ffffff",
  surfaceAlt: "#e9f5f2",
  border: "rgba(6,45,45,0.10)",
  text: "#06231f",
  muted: "rgba(6,35,31,0.6)",
  faint: "rgba(6,35,31,0.35)",
  primary: brand.teal,
  primaryText: "#ffffff",
  accent: brand.blueDeep,
  bubbleMine: brand.teal,
  bubbleTheirs: "#e3efee",
  danger: "#e11d48",
  success: brand.green,
  overlay: "rgba(4,25,25,0.45)"
};

export const palettes = { dark, light };

export const fonts = {
  display: "Poppins_600SemiBold",
  displayBold: "Poppins_700Bold",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemi: "Inter_600SemiBold"
};

export const radius = { sm: 10, md: 16, lg: 22, pill: 999 };
export const space = { xs: 6, sm: 10, md: 16, lg: 22, xl: 30 };
