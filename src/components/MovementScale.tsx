import { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

import type { MindsMovedMember } from "../data";
import { colors, positionColor, spacing } from "../theme";
import { ScaleTrack } from "./MiniScale";

const START_MS = 600;
const STAGGER_MS = 150;
const SLIDE_MS = 900;

const rowTop = (row: number) => (row % 2 ? 34 : 0);

function MovingDot({ member, you, row }: { member: MindsMovedMember; you: boolean; row: number }) {
  const after = member.after ?? member.aiAfter ?? member.before;
  const [position] = useState(() => new Animated.Value(member.before));

  useEffect(() => {
    position.setValue(member.before);
    const slide = Animated.timing(position, {
      toValue: after,
      delay: START_MS + row * STAGGER_MS,
      duration: SLIDE_MS,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    });
    slide.start();
    return () => slide.stop();
  }, [member.before, after, row, position]);

  return (
    <Animated.View style={[styles.marker, { top: rowTop(row), left: position.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }) }]}>
      <View style={[styles.dot, { backgroundColor: positionColor(after) }, you && styles.you]} />
      <Text style={[styles.name, you && { color: colors.accent }]} numberOfLines={1}>
        {you ? "You" : member.name}
      </Text>
    </Animated.View>
  );
}

// Hollow dots mark where everyone started; filled dots slide to where they stand now (their answer, else the AI estimate).
export function MovementScale({ members, youId, sideA, sideB }: { members: MindsMovedMember[]; youId: string | null; sideA?: string; sideB?: string }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.area}>
        <ScaleTrack />
        {members.map((m, i) => (
          <View key={`before-${m.userId}`} style={[styles.marker, { top: rowTop(i), left: `${m.before}%` }]}>
            <View style={[styles.dot, styles.before, { borderColor: positionColor(m.before) }]} />
          </View>
        ))}
        {members.map((m, i) => (
          <MovingDot key={m.userId} member={m} you={m.userId === youId} row={i} />
        ))}
      </View>
      {(sideA || sideB) && (
        <View style={styles.ends}>
          <Text style={[styles.end, { color: colors.sideA }]}>{sideA}</Text>
          <Text style={[styles.end, { color: colors.sideB, textAlign: "right" }]}>{sideB}</Text>
        </View>
      )}
    </View>
  );
}

const DOT = 18;

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  area: { height: 76, justifyContent: "center" },
  marker: { position: "absolute", width: 64, marginLeft: -32, alignItems: "center" },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, borderWidth: 3, borderColor: colors.background },
  before: { backgroundColor: colors.background, borderWidth: 2, opacity: 0.7 },
  you: { borderColor: colors.accent },
  name: { fontSize: 12, fontWeight: "600", color: colors.text, marginTop: 2 },
  ends: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md, marginHorizontal: -spacing.lg },
  end: { fontSize: 13, fontWeight: "700", flexShrink: 1 },
});
