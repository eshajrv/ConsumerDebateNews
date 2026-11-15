import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Animated, Easing, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../../../src/components/Button";
import { MovementScale } from "../../../src/components/MovementScale";
import { useMindsMoved, useMyRank, useRoom, useRoomSummaries, useUser } from "../../../src/data";
import { useSavedUserId } from "../../../src/session";
import { card, colors, radius, spacing, type } from "../../../src/theme";

// Same threshold as MOVED in convex/rooms.ts
const MOVED = 10;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function Stat({ label, value, delta }: { label: string; value: string; delta?: number }) {
  return (
    <View style={[card, styles.stat]}>
      <Text style={[type.label, styles.statLabel]} numberOfLines={2}>
        {label}
      </Text>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      {delta !== undefined && (
        <View style={[styles.deltaPill, { backgroundColor: delta > 0 ? colors.sideBSoft : delta < 0 ? colors.sideASoft : colors.surface }]}>
          <Text style={[styles.delta, { color: delta > 0 ? colors.sideB : delta < 0 ? colors.sideA : colors.muted }]}>
            {delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : "±0"}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function Results() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useSavedUserId();
  const data = useRoomSummaries(id, userId);
  const user = useUser(userId);
  const rank = useMyRank(userId, "today");
  const room = useRoom(id);
  const minds = useMindsMoved(id);
  const [count] = useState(() => new Animated.Value(0));
  const [bounce] = useState(() => new Animated.Value(1));
  const [shown, setShown] = useState(0);

  const authored = data?.summaries.find((s) => s.authorId === userId);
  const rating = authored?.gotMeRating ?? null;
  const points = authored?.points ?? null;

  useEffect(() => {
    if (points === null) return;
    const sub = count.addListener(({ value }) => setShown(Math.round(value)));
    count.setValue(0);
    bounce.setValue(1);
    const countUp = Animated.timing(count, { toValue: points, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    countUp.start(({ finished }) => {
      if (!finished) return;
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1.18, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(bounce, { toValue: 1, friction: 3, tension: 160, useNativeDriver: true }),
      ]).start();
    });
    return () => {
      countUp.stop();
      count.removeListener(sub);
    };
  }, [points, count, bounce]);

  if (!data || !userId || !user) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        {data === null ? <Text style={type.body}>Room not found.</Text> : <ActivityIndicator color={colors.accent} />}
      </SafeAreaView>
    );
  }

  const subjectName = authored?.aboutName || "They";

  if (rating === null || points === null) {
    return (
      <SafeAreaView style={[styles.safe, styles.center, styles.padded]}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={type.title}>Waiting for {subjectName} to rate your summary...</Text>
      </SafeAreaView>
    );
  }

  const myMove = minds?.members.find((m) => m.userId === userId);
  let moveLine: string | null = null;
  if (myMove && myMove.after !== null && myMove.shift !== null) {
    const { before, after, shift } = myMove;
    const toward = minds!.members
      .filter((m) => m.userId !== userId && Math.sign(m.before - before) === Math.sign(shift))
      .sort((a, b) => Math.abs(a.before - after) - Math.abs(b.before - after))[0];
    const towardName = toward?.name ?? (shift > 0 ? room?.topic?.sideB : room?.topic?.sideA) ?? "the other side";
    moveLine = Math.abs(shift) >= MOVED ? `You moved ${Math.abs(shift)} points toward ${towardName}` : "You held your view";
  }

  const bonus = points - rating * 10;
  const goodFaithChange = (rating - 3) * 2;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={type.label}>Results</Text>
        <View style={styles.hero}>
          <Animated.Text style={[styles.points, { transform: [{ scale: bounce }] }]}>+{shown}</Animated.Text>
          <Text style={styles.muted}>points for understanding {subjectName}</Text>
          <Text style={styles.total}>
            {user.totalPoints ?? 0} points total{rank ? ` · ${rank.points} today` : ""}
          </Text>
        </View>

        <View style={[card, styles.breakdown]}>
          <Row label={`${rating} star${rating === 1 ? "" : "s"} × 10`} value={`+${rating * 10}`} />
          <Row
            label={bonus > 0 ? `${subjectName} couldn't tell yours from the AI's` : `${subjectName} spotted yours`}
            value={`+${Math.max(0, bonus)}`}
          />
          <View style={styles.divider} />
          <Row label="Total" value={`+${points}`} />
        </View>

        {minds && minds.total > 0 && (
          <View style={[card, styles.minds]}>
            <Text style={type.label}>Minds moved</Text>
            <Text style={styles.mindsCount}>
              {minds.movedCount}/{minds.total}
            </Text>
            {moveLine && <Text style={styles.moveLine}>{moveLine}</Text>}
            <MovementScale members={minds.members} youId={userId} sideA={room?.topic?.sideA} sideB={room?.topic?.sideB} />
            <Text style={styles.legend}>Hollow dots show where everyone started.</Text>
          </View>
        )}

        <View style={styles.stats}>
          <Stat label="Day streak" value={String(user.streak)} />
          <Stat label="Good faith" value={String(user.goodFaithScore)} delta={goodFaithChange} />
          <Stat label="Rank today" value={rank?.rank ? `#${rank.rank}` : "-"} />
        </View>

        {user.insight && (
          <View style={styles.insight}>
            <Text style={[type.label, { color: colors.accent }]}>What we noticed</Text>
            <Text style={styles.insightText}>{user.insight}</Text>
          </View>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <Button title="Back to today's topics" onPress={() => router.replace("/home")} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: "center", justifyContent: "center", gap: spacing.md },
  padded: { padding: spacing.screen },
  content: { padding: spacing.screen, gap: spacing.lg },
  hero: { alignItems: "center", gap: spacing.xs, paddingVertical: spacing.md },
  points: { fontSize: 72, fontWeight: "800", color: colors.accent, fontVariant: ["tabular-nums"] },
  muted: { fontSize: 16, color: colors.muted, textAlign: "center" },
  total: { fontSize: 15, fontWeight: "700", color: colors.text, marginTop: spacing.xs },
  breakdown: { gap: spacing.sm },
  row: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  rowLabel: { ...type.body, flex: 1 },
  rowValue: { ...type.body, fontWeight: "700", fontVariant: ["tabular-nums"] },
  divider: { height: 1, backgroundColor: colors.border },
  minds: { alignItems: "center", gap: spacing.sm, paddingHorizontal: 0 },
  mindsCount: { fontSize: 56, fontWeight: "800", color: colors.accent, fontVariant: ["tabular-nums"] },
  moveLine: { ...type.body, fontWeight: "600", textAlign: "center", paddingHorizontal: spacing.lg },
  legend: { fontSize: 13, color: colors.muted },
  stats: { flexDirection: "row", gap: spacing.sm },
  stat: { flex: 1, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, gap: spacing.xs, alignItems: "center" },
  deltaPill: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  statLabel: { textAlign: "center" },
  statValue: { fontSize: 22, fontWeight: "800", color: colors.text },
  delta: { fontSize: 14, fontWeight: "700" },
  insight: { backgroundColor: colors.accentSoft, borderRadius: radius.card, padding: spacing.lg, gap: spacing.xs },
  insightText: { fontSize: 18, lineHeight: 24, fontWeight: "600", color: colors.text },
  footer: { padding: spacing.screen, paddingTop: spacing.sm },
});

export { RoomErrorBoundary as ErrorBoundary } from "../../../src/components/RoomErrorBoundary";
