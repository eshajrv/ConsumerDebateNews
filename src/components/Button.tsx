import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import { colors, fonts, radius, spacing } from "../theme";

// "feature" is the brass button used on the deep green house table card
type Props = { title: string; onPress: () => void; disabled?: boolean; loading?: boolean; variant?: "main" | "feature" };

export function Button({ title, onPress, disabled, loading, variant = "main" }: Props) {
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off }}
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [styles.button, variant === "feature" && styles.feature, off && styles.disabled, pressed && styles.pressed]}
    >
      {loading ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.text}>{title}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: spacing.md + 2,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
  },
  feature: { backgroundColor: colors.featureAccent },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.85 },
  text: { color: colors.onAccent, fontSize: 17, fontFamily: fonts.bold },
});
