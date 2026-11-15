import { Pressable, StyleSheet, View } from "react-native";

import { colors } from "../theme";

export function Trophy({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={12} accessibilityRole="button" accessibilityLabel="Leaderboard" style={styles.wrap}>
      <View style={styles.cup} />
      <View style={styles.stem} />
      <View style={styles.base} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  cup: { width: 16, height: 12, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, borderWidth: 2, borderTopWidth: 2, borderColor: colors.text },
  stem: { width: 2, height: 4, backgroundColor: colors.text },
  base: { width: 12, height: 2, borderRadius: 1, backgroundColor: colors.text },
});
