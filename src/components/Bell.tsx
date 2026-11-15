import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";

export function Bell({ count, onPress }: { count: number; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={12} accessibilityLabel={`Notifications, ${count} unread`} style={styles.wrap}>
      <View style={styles.dome} />
      <View style={styles.rim} />
      <View style={styles.clapper} />
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 9 ? "9+" : count}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  dome: { width: 16, height: 15, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderWidth: 2, borderBottomWidth: 0, borderColor: colors.text },
  rim: { width: 22, height: 2, borderRadius: 1, backgroundColor: colors.text },
  clapper: { width: 6, height: 3, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, backgroundColor: colors.text, marginTop: 1 },
  badge: {
    position: "absolute",
    top: -2,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: colors.onAccent, fontSize: 11, fontWeight: "700" },
});
