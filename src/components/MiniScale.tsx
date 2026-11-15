import { StyleSheet, Text, View } from "react-native";

import type { RoomMember } from "../data";
import { colors, positionColor, radius, spacing } from "../theme";

export function MiniScale({ members, youId, sideA, sideB }: { members: RoomMember[]; youId: string | null; sideA?: string; sideB?: string }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.area}>
        <View style={styles.track}>
          <View style={{ flex: 1, backgroundColor: colors.sideA }} />
          <View style={{ flex: 1, backgroundColor: "#B9B9C2" }} />
          <View style={{ flex: 1, backgroundColor: colors.sideB }} />
        </View>
        {members.map((m, i) => {
          const you = m.userId === youId;
          return (
            <View key={m.userId} style={[styles.member, { left: `${m.position}%`, top: i % 2 ? 34 : 0 }]}>
              <View style={[styles.dot, { backgroundColor: positionColor(m.position) }, you && styles.you]} />
              <Text style={[styles.name, you && { color: colors.accent }]} numberOfLines={1}>
                {you ? "You" : m.name}
              </Text>
            </View>
          );
        })}
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
