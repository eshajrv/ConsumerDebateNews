import { useEffect, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

import type { RoomMember } from "../data";
import { colors, positionColor, radius, spacing } from "../theme";

const DROP_STAGGER_MS = 110;

// How long the drop-in takes for a scale with `count` members, so callers can sequence after it.
export const dropInDuration = (count: number) => count * DROP_STAGGER_MS + 500;

function MemberDot({ member, you, row, dropIn, delay }: { member: RoomMember; you: boolean; row: number; dropIn: boolean; delay: number }) {
  const [drop] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!dropIn) return;
    drop.setValue(0);
    const anim = Animated.spring(drop, { toValue: 1, delay, friction: 6, tension: 80, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [dropIn, delay, drop]);

  return (
    <Animated.View
      style={[
        styles.member,
        { left: `${member.position}%`, top: row % 2 ? 34 : 0 },
        {
          opacity: drop,
          transform: [
            { translateY: drop.interpolate({ inputRange: [0, 1], outputRange: [-28, 0] }) },
            { scale: drop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
          ],
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: positionColor(member.position) }, you && styles.you]} />
      <Text style={[styles.name, you && { color: colors.accent }]} numberOfLines={1}>
        {you ? "You" : member.name}
      </Text>
    </Animated.View>
  );
}

export function ScaleTrack() {
  return (
    <View style={styles.track}>
      <View style={{ flex: 1, backgroundColor: colors.sideA }} />
      <View style={{ flex: 1, backgroundColor: "#B9B9C2" }} />
      <View style={{ flex: 1, backgroundColor: colors.sideB }} />
    </View>
  );
}

export function MiniScale({
  members,
  youId,
  sideA,
  sideB,
  dropIn = false,
}: {
  members: RoomMember[];
  youId: string | null;
  sideA?: string;
  sideB?: string;
  dropIn?: boolean;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.area}>
        <ScaleTrack />
        {members.map((m, i) => (
          <MemberDot key={m.userId} member={m} you={m.userId === youId} row={i} dropIn={dropIn} delay={i * DROP_STAGGER_MS} />
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
  track: { flexDirection: "row", height: 6, borderRadius: radius.pill, overflow: "hidden", opacity: 0.35 },
  member: { position: "absolute", width: 64, marginLeft: -32, alignItems: "center" },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, borderWidth: 3, borderColor: colors.background },
  you: { borderColor: colors.accent },
  name: { fontSize: 12, fontWeight: "600", color: colors.text, marginTop: 2 },
  ends: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md, marginHorizontal: -spacing.lg },
  end: { fontSize: 13, fontWeight: "700", flexShrink: 1 },
});
