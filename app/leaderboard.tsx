import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BackButton } from "../src/components/BackButton";
import { Chip } from "../src/components/Chip";
import { type LeaderboardPeriod, useLeaderboard, useMyRank, useUser } from "../src/data";
import { useSavedUserId } from "../src/session";
import { card, colors, fonts, spacing, type } from "../src/theme";

const PERIODS: { value: LeaderboardPeriod; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
];

function Row({ rank, name, points, mine }: { rank: number | null; name: string; points: number; mine: boolean }) {
  return (
    <View style={[styles.row, mine && styles.mineRow]}>
      <Text style={[styles.rank, mine && styles.mineText]}>{rank ?? "-"}</Text>
      <Text style={[styles.name, mine && styles.mineText]} numberOfLines={1}>
        {mine ? `${name || "You"} (you)` : name}
      </Text>
      <Text style={[styles.points, mine && styles.mineText]}>{points} pts</Text>
    </View>
  );
}

export default function Leaderboard() {
  const [period, setPeriod] = useState<LeaderboardPeriod>("today");
  const userId = useSavedUserId();
  const top = useLeaderboard(period);
  const me = useMyRank(userId, period);
  const user = useUser(userId);

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
          <Text style={styles.empty}>No points yet. Pull up a chair at a table to get on the board.</Text>
        ) : (
          <View style={[card, styles.card]}>
            {top.map((e) => (
              <Row key={e.userId} rank={e.rank} name={e.name} points={e.points} mine={e.userId === userId} />
            ))}
          </View>
        )}
      </ScrollView>

      {me && (
        <View style={styles.pinned}>
          <Row rank={me.rank} name={user?.name ?? ""} points={me.points} mine />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  top: { paddingHorizontal: spacing.screen, paddingTop: spacing.sm },
  header: { paddingHorizontal: spacing.screen, paddingTop: spacing.md, gap: spacing.md },
  tabs: { flexDirection: "row", gap: spacing.sm },
  list: { padding: spacing.screen },
  card: { paddingVertical: spacing.sm, paddingHorizontal: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md, borderRadius: 12 },
  mineRow: { backgroundColor: colors.accentSoft },
  rank: { width: 28, fontSize: 16, fontFamily: fonts.bold, color: colors.muted, fontVariant: ["tabular-nums"] },
  name: { flex: 1, fontSize: 16, fontFamily: fonts.semibold, color: colors.text },
  points: { fontSize: 16, fontFamily: fonts.bold, color: colors.text, fontVariant: ["tabular-nums"] },
  mineText: { color: colors.accent },
  empty: { fontSize: 16, fontFamily: fonts.regular, color: colors.muted, textAlign: "center" },
  pinned: { paddingHorizontal: spacing.screen, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
});
