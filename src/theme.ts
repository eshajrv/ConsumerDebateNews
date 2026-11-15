export const colors = {
  background: "#FFFFFF",
  surface: "#F6F6F8",
  border: "#E8E8EC",
  text: "#16161A",
  muted: "#6B6B76",
  accent: "#6C4DF6",
  accentSoft: "#EEEAFE",
  onAccent: "#FFFFFF",
  sideA: "#FF7A66",
  sideASoft: "#FFE9E5",
  sideB: "#14A89A",
  sideBSoft: "#DDF4F1",
  error: "#B4232C",
};

export const radius = { card: 16, pill: 999 };

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };

export const type = {
  question: { fontSize: 24, lineHeight: 30, fontWeight: "700" as const, color: colors.text },
  title: { fontSize: 20, lineHeight: 26, fontWeight: "700" as const, color: colors.text },
  body: { fontSize: 16, lineHeight: 22, color: colors.text },
  label: { fontSize: 13, lineHeight: 18, fontWeight: "600" as const, color: colors.muted },
};

export const card = {
  backgroundColor: colors.background,
  borderRadius: radius.card,
  borderWidth: 1,
  borderColor: colors.border,
  padding: spacing.lg,
};
