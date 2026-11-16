import { useState } from "react";
import { type LayoutChangeEvent, StyleSheet, Text, View } from "react-native";

import { colors, fonts, positionColor, spacing } from "../theme";

type Seat = { userId: string; name: string; position: number };

type Props = {
  members: Seat[];
  youId: string | null;
  seats?: number; // total chairs; empty chairs show while the table fills
  sideA?: string;
  sideB?: string;
  height?: number; // smaller in the chat, where space is tight
};

const SEAT = 38;

const sideOf = (position: number, sideA: string, sideB: string) =>
  position <= 35 ? sideA : position >= 65 ? sideB : "the middle";

// An oval table in deep green with a brass border; members sit around it as initials,
// colored by where they stand. Your seat has a brass ring.
export function SeatTable({ members, youId, seats, sideA, sideB, height: HEIGHT = 168 }: Props) {
  const [width, setWidth] = useState(0);
  const total = Math.max(seats ?? members.length, members.length, 1);
  const me = members.find((m) => m.userId === youId);

  const cx = width / 2;
  const cy = HEIGHT / 2;
  const rx = width / 2 - SEAT / 2 - 2;
  const ry = HEIGHT / 2 - SEAT / 2 - 2;
  // Chairs start at the top and go clockwise
  const spot = (i: number) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / total;
    return { left: cx + rx * Math.cos(a) - SEAT / 2, top: cy + ry * Math.sin(a) - SEAT / 2 };
  };

  return (
    <View style={styles.wrap}>
      <View style={{ height: HEIGHT }} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
        <View style={styles.table} />
        {width > 0 &&
          Array.from({ length: total }, (_, i) => {
            const m = members[i];
            const pos = spot(i);
            if (!m) return <View key={`empty-${i}`} style={[styles.seat, styles.emptySeat, pos]} />;
            const you = m.userId === youId;
            return (
              <View
                key={m.userId}
                accessibilityLabel={`${m.name || "Someone"}${you ? " (you)" : ""}`}
                style={[styles.seat, pos, { backgroundColor: positionColor(m.position) }, you && styles.you]}
              >
                <Text style={styles.initial}>{(m.name || "?").charAt(0).toUpperCase()}</Text>
              </View>
            );
          })}
      </View>
      {sideA && sideB && (
        <View style={styles.labels}>
          <Text style={[styles.label, { color: colors.sideA }]} numberOfLines={2}>
            {sideA}
          </Text>
          {me && <Text style={[styles.label, styles.youLabel]} numberOfLines={2}>{`you: ${sideOf(me.position, sideA, sideB)}`}</Text>}
          <Text style={[styles.label, { color: colors.sideB, textAlign: "right" }]} numberOfLines={2}>
            {sideB}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  table: {
    position: "absolute",
    left: SEAT / 2 + 8,
    right: SEAT / 2 + 8,
    top: SEAT / 2 + 8,
    bottom: SEAT / 2 + 8,
    borderRadius: 999,
    backgroundColor: colors.feature,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  seat: {
    position: "absolute",
    width: SEAT,
    height: SEAT,
    borderRadius: SEAT / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.background,
  },
  emptySeat: { backgroundColor: colors.surface, borderColor: colors.border, borderStyle: "dashed" },
  you: { borderColor: colors.accent, borderWidth: 3 },
  initial: { fontSize: 15, fontFamily: fonts.bold, color: colors.text },
  labels: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  label: { flex: 1, fontSize: 12, lineHeight: 16, fontFamily: fonts.semibold },
  youLabel: { color: colors.text, textAlign: "center" },
});
