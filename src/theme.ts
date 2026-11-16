// speak-easy: a light speakeasy look (cream paper, ink green, brass) that works any time of day.
export const colors = {
  background: "#F7F1E5", // cream
  surface: "#FFFDF8",
  border: "#E3D7C1",
  text: "#1D2A24", // ink green
  muted: "#6F6A5E",
  accent: "#B8862B", // brass
  accentSoft: "#F3E6C8",
  onAccent: "#1D2A24",
  feature: "#1F3A31", // deep green, for the house table card
  featureText: "#F7F1E5",
  featureAccent: "#E0B45A",
  sideA: "#D9654F",
  sideASoft: "#FBE6E1",
  sideB: "#2A9D8F",
  sideBSoft: "#DDF1EE",
  middle: "#CDBE9F",
  middleSoft: "#F1EADB", // light sand, for middle-band chat bubbles
  middleText: "#7D6E4E",
  error: "#B4232C",
};

// Font family names registered with useFonts in app/_layout.tsx
export const fonts = {
  wordmark: "PlayfairDisplay_600SemiBold", // the "speak-easy" wordmark, same family as titles
  display: "PlayfairDisplay_600SemiBold", // questions and titles
  displayMedium: "PlayfairDisplay_500Medium",
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
};

// Custom fonts don't respond to fontWeight, so pick the Inter file that matches the weight.
export function interFor(weight?: string | number): string {
  const w = Number(weight ?? 400);
  return w >= 700 ? fonts.bold : w >= 600 ? fonts.semibold : w >= 500 ? fonts.medium : fonts.regular;
}

export const radius = { card: 16, pill: 999 };

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48, screen: 16 };

export const type = {
  question: { fontSize: 24, lineHeight: 30, fontFamily: fonts.display, color: colors.text },
  title: { fontSize: 20, lineHeight: 26, fontFamily: fonts.display, color: colors.text },
  body: { fontSize: 16, lineHeight: 22, fontFamily: fonts.regular, color: colors.text },
  label: { fontSize: 13, lineHeight: 18, fontFamily: fonts.semibold, color: colors.muted },
  // Category labels: brass capitals with letter spacing
  category: { fontSize: 12, lineHeight: 16, fontFamily: fonts.semibold, color: colors.accent, letterSpacing: 1.5, textTransform: "uppercase" as const },
};

export const card = {
  backgroundColor: colors.surface,
  borderRadius: radius.card,
  borderWidth: 0.5,
  borderColor: colors.border,
  padding: spacing.lg,
};

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number) =>
  `rgb(${hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t)).join(",")})`;

// sideA -> middle -> sideB
export function positionColor(position: number) {
  const p = Math.max(0, Math.min(100, position)) / 100;
  return p < 0.5 ? mix(colors.sideA, colors.middle, p * 2) : mix(colors.middle, colors.sideB, (p - 0.5) * 2);
}
