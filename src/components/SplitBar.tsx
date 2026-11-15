import { StyleSheet, Text, View } from "react-native";

import type { TopicStats } from "../data";
import { colors, radius, spacing } from "../theme";

export function SplitBar({ stats, sideA, sideB }: { stats: TopicStats | undefined; sideA: string; sideB: string }) {
  const total = stats?.total ?? 0;
  const aPct = total ? Math.round(((stats?.leanA ?? 0) / total) * 100) : 50;
  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        <View style={{ flex: aPct, backgroundColor: colors.sideA }} />
        <View style={{ flex: 100 - aPct, backgroundColor: colors.sideB }} />
      </View>
      <View style={styles.labels}>
        <Text style={[styles.label, { color: colors.sideA }]} numberOfLines={2}>
          {sideA} {total ? `${aPct}%` : ""}
        </Text>
        <Text style={[styles.label, { color: colors.sideB, textAlign: "right" }]} numberOfLines={2}>
          {total ? `${100 - aPct}%` : ""} {sideB}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs + 2 },
  bar: { flexDirection: "row", height: 8, borderRadius: radius.pill, overflow: "hidden", gap: 2 },
  labels: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  label: { fontSize: 13, lineHeight: 17, fontWeight: "600", flex: 1 },
});
