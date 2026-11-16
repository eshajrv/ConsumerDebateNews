import { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

import { colors, fonts, radius, spacing } from "../theme";

const DOTS = 3;
const STAGGER = 150;
const HOP = 300;

function typingLabel(names: string[]) {
  if (names.length === 1) return `${names[0]} is typing`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing`;
  return `${names.length} people are typing`;
}

// A small grey bubble with three bouncing dots, plus "Maya is typing"
export function TypingBubble({ names }: { names: string[] }) {
  const [dots] = useState(() => Array.from({ length: DOTS }, () => new Animated.Value(0)));

  useEffect(() => {
    const loops = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * STAGGER),
          Animated.timing(dot, { toValue: 1, duration: HOP, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: HOP, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.delay((DOTS - 1 - i) * STAGGER),
        ]),
      ),
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [dots]);

  const label = typingLabel(names);
  return (
    <View style={styles.row} accessibilityRole="text" accessibilityLabel={label}>
      <View style={styles.bubble}>
        {dots.map((dot, i) => (
          <Animated.View
            key={i}
            style={[styles.dot, { transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] }]}
          />
        ))}
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  bubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.border,
    borderRadius: radius.card,
    borderBottomLeftRadius: 4,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md - 4,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.muted },
  label: { fontSize: 13, fontFamily: fonts.medium, color: colors.muted },
});
