import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import { colors, radius, spacing } from "../theme";

type Props = { title: string; onPress: () => void; disabled?: boolean; loading?: boolean };

export function Button({ title, onPress, disabled, loading }: Props) {
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off }}
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [styles.button, off && styles.disabled, pressed && styles.pressed]}
    >
      {loading ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.text}>{title}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.card,
    paddingVertical: spacing.md + 2,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
  },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.85 },
  text: { color: colors.onAccent, fontSize: 17, fontWeight: "700" },
});
