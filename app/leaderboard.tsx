import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BackButton } from "../src/components/BackButton";
import { Chip } from "../src/components/Chip";
import { type LeaderboardEntry, type LeaderboardPeriod, useLeaderboard, useMyRank } from "../src/data";
import { useSavedUserId } from "../src/session";
import { card, colors, spacing, type } from "../src/theme";

const PERIODS: { value: LeaderboardPeriod; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
];

function Row({ entry, mine }: { entry: LeaderboardEntry; mine: boolean }) {
  return (
    <View style={[styles.row, mine && styles.mineRow]}>
      <Text style={[styles.rank, mine && styles.mineText]}>{entry.rank}</Text>
      <View style={styles.flex}>
        <Text style={[styles.name, mine && styles.mineText]} numberOfLines={1}>
          {mine ? `${entry.name} (you)` : entry.name}
        </Text>
        <Text style={styles.goodFaith}>Good faith {entry.goodFaithScore}</Text>
      </View>
      <Text style={[styles.points, mine && styles.mineText]}>{entry.points} pts</Text>
    </View>
  );
}

export default function Leaderboard() {
  const [period, setPeriod] = useState<LeaderboardPeriod>("today");
  const userId = useSavedUserId();
  const top = useLeaderboard(period);
  const me = useMyRank(userId, period);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <BackButton />
      </View>
      <View style={styles.header}>
        <Text style={type.question}>Leaderboard</Text>
        <View style={styles.tabs}>
          {PERIODS.map((p) => (
            <Chip key={p.value} label={p.label} selected={period === p.value} onPress={() => setPeriod(p.value)} />
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {top === undefined ? (
          <ActivityIndicator color={colors.accent} />
        ) : top.length === 0 ? (
          <Text style={styles.empty}>No points yet. Join a room to get on the board.</Text>
        ) : (
          <View style={[card, styles.card]}>
            {top.map((e) => (
              <Row key={e.userId} entry={e} mine={e.userId === userId} />
            ))}
          </View>
        )}
      </ScrollView>

      {me && (
        <View style={styles.pinned}>
          <Row entry={me} mine />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  top: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md },
  tabs: { flexDirection: "row", gap: spacing.sm },
  list: { padding: spacing.lg },
  card: { paddingVertical: spacing.sm, paddingHorizontal: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md, borderRadius: 12 },
  mineRow: { backgroundColor: colors.accentSoft },
  rank: { width: 28, fontSize: 16, fontWeight: "700", color: colors.muted, fontVariant: ["tabular-nums"] },
  flex: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: "600", color: colors.text },
  goodFaith: { fontSize: 12, color: colors.muted },
  points: { fontSize: 16, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] },
  mineText: { color: colors.accent },
  empty: { fontSize: 16, color: colors.muted, textAlign: "center" },
  pinned: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
});
