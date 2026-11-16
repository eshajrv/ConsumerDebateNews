import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, fonts, positionColor, radius, spacing } from "../theme";

type Props = { value: number; sideA: string; sideB: string; onChange: (v: number) => void; onRelease: (v: number) => void };

const THUMB = 32;

export function StanceSlider({ value, sideA, sideB, onChange, onRelease }: Props) {
  const [width, setWidth] = useState(1);
  const toValue = (x: number) => Math.max(0, Math.min(100, Math.round(((x - THUMB / 2) / (width - THUMB)) * 100)));

  return (
    <View style={styles.wrap}>
      <View
        style={styles.touch}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessibilityRole="adjustable"
        accessibilityValue={{ min: 0, max: 100, now: value }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => onChange(toValue(e.nativeEvent.locationX))}
        onResponderMove={(e) => onChange(toValue(e.nativeEvent.locationX))}
        onResponderRelease={(e) => onRelease(toValue(e.nativeEvent.locationX))}
      >
        <View style={styles.track} pointerEvents="none">
          <View style={{ flex: 1, backgroundColor: colors.sideASoft }} />
          <View style={{ flex: 1, backgroundColor: colors.sideBSoft }} />
        </View>
        <View
          pointerEvents="none"
          style={[styles.thumb, { left: (value / 100) * (width - THUMB), backgroundColor: positionColor(value) }]}
        />
      </View>
      <View style={styles.labels}>
        <Text style={[styles.label, { color: colors.sideA }]}>{sideA}</Text>
        <Text style={[styles.label, styles.right, { color: colors.sideB }]}>{sideB}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  touch: { height: 44, justifyContent: "center" },
  track: { flexDirection: "row", height: 10, borderRadius: radius.pill, overflow: "hidden", marginHorizontal: THUMB / 2 },
  thumb: {
    position: "absolute",
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 4,
    borderColor: colors.background,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  labels: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  label: { fontSize: 15, fontFamily: fonts.bold, flexShrink: 1 },
  right: { textAlign: "right" },
});
