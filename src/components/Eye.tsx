import { Pressable, StyleSheet, View } from "react-native";

import { colors } from "../theme";

export function Eye({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={12} accessibilityRole="button" accessibilityLabel="Watch live" style={styles.wrap}>
      <View style={styles.lid}>
        <View style={styles.pupil} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  lid: {
    width: 22,
    height: 14,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ scaleY: 0.9 }],
  },
  pupil: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.text },
});
