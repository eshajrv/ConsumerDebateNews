import { Pressable, StyleSheet, Text } from "react-native";

import { colors, radius } from "../theme";

export function ProfileButton({ name, onPress }: { name?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={12} accessibilityRole="button" accessibilityLabel="Your profile" style={styles.wrap}>
      <Text style={styles.initial}>{name?.trim().charAt(0).toUpperCase() || "·"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 32, height: 32, borderRadius: radius.pill, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  initial: { fontSize: 15, fontWeight: "800", color: colors.onAccent },
});
