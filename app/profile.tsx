import { router } from "expo-router";
import { type ReactNode, useEffect, useState } from "react";
import { ActivityIndicator, Animated, Easing, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BackButton } from "../src/components/BackButton";
import { Button } from "../src/components/Button";
import { Chip } from "../src/components/Chip";
import { useMyRank, useUser } from "../src/data";
import { useSavedUserId } from "../src/session";
import { card, colors, fonts, radius, spacing, type } from "../src/theme";

function Stat({ emoji, label, value, unit, note, children }: { emoji: string; label: string; value: number; unit: string; note: string; children?: ReactNode }) {
  return (
    <View style={[card, styles.stat]}>
      <Text style={type.label} numberOfLines={1}>
        {emoji} {label}
      </Text>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
        <Text style={styles.statUnit}>{unit}</Text>
      </Text>
      {children}
      <Text style={styles.statNote}>{note}</Text>
    </View>
  );
}

function memberSince(creationTime: number) {
  const created = new Date(creationTime);
  if (!creationTime || created.toDateString() === new Date().toDateString()) return "Member since today";
  return `Member since ${created.toLocaleDateString(undefined, { month: "long", day: "numeric" })}`;
}

export default function Profile() {
  const userId = useSavedUserId();
  const user = useUser(userId);
  const rank = useMyRank(userId, "today");
  const [progress] = useState(() => new Animated.Value(0));
  const [t, setT] = useState(0);
  const loadedId = user?._id;

  useEffect(() => {
    if (!loadedId) return;
    const sub = progress.addListener(({ value }) => setT(value));
    progress.setValue(0);
    const countUp = Animated.timing(progress, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    countUp.start();
    return () => {
      countUp.stop();
      progress.removeListener(sub);
    };
  }, [loadedId, progress]);

  if (user === null) {
    return (
      <SafeAreaView style={[styles.safe, styles.center, styles.padded]}>
        <Text style={[type.title, styles.centerText]}>{"We couldn't find your profile."}</Text>
        <Button title="Set up my profile" onPress={() => router.replace("/onboarding")} />
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }

  const firstName = user.name.trim().split(/\s+/)[0] || "Friend";
  const streak = user.streak ?? 0;
  const goodFaith = Math.max(0, Math.min(100, user.goodFaithScore ?? 50));
  const points = user.totalPoints ?? 0;
  const interests = user.interests ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.top}>
        <BackButton />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.initial}>{firstName.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={type.question}>{firstName}</Text>
          <Text style={type.label}>{memberSince(user._creationTime)}</Text>
        </View>

        <View style={styles.stats}>
          <Stat emoji="🔥" label="Streak" value={Math.round(streak * t)} unit={streak === 1 ? " day" : " days"} note="Keep it going tomorrow" />
          <Stat emoji="🤝" label="Good faith" value={Math.round(goodFaith * t)} unit="/100" note="How well you listen">
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${goodFaith * t}%` }]} />
            </View>
          </Stat>
          <Stat emoji="⭐" label="Points" value={Math.round(points * t)} unit="" note={rank?.rank ? `#${rank.rank} today` : "Total so far"} />
        </View>

        <View style={styles.insight}>
          <Text style={[type.label, styles.accentLabel]}>{"What we've learned about you"}</Text>
          {user.insight ? (
            <Text style={styles.insightText}>{user.insight}</Text>
          ) : (
            <Text style={styles.muted}>Pull up a chair at a table to start building your profile.</Text>
          )}
        </View>

        <View style={[card, styles.section]}>
          <Text style={type.label}>Interests</Text>
          {interests.length > 0 ? (
            <View style={styles.chips}>
              {interests.map((i) => (
                <Chip key={i} label={i.charAt(0).toUpperCase() + i.slice(1)} selected />
              ))}
            </View>
          ) : (
            <Text style={styles.muted}>No interests picked yet.</Text>
          )}
        </View>

        <View style={[card, styles.section]}>
          <Text style={type.label}>How speak-easy reaches you</Text>
          <Text style={type.body}>{user.notifyVia === "text" ? "By text" : "In the app"}</Text>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Button title="See the leaderboard" onPress={() => router.push("/leaderboard")} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: "center", justifyContent: "center", gap: spacing.md },
  centerText: { textAlign: "center" },
  padded: { padding: spacing.screen },
  top: { paddingHorizontal: spacing.screen, paddingTop: spacing.sm },
  content: { padding: spacing.screen, gap: spacing.md },
  header: { alignItems: "center", gap: spacing.xs, paddingBottom: spacing.sm },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  initial: { fontSize: 42, fontFamily: fonts.bold, color: colors.onAccent },
  stats: { flexDirection: "row", gap: spacing.sm },
  stat: { flex: 1, paddingVertical: spacing.md, paddingHorizontal: spacing.sm + 4, gap: spacing.xs },
  statValue: { fontSize: 28, fontFamily: fonts.bold, lineHeight: 34, color: colors.text, fontVariant: ["tabular-nums"] },
  statUnit: { fontSize: 14, fontFamily: fonts.bold, color: colors.muted },
  statNote: { fontSize: 12, fontFamily: fonts.regular, lineHeight: 16, color: colors.muted },
  track: { height: 4, borderRadius: radius.pill, backgroundColor: colors.accentSoft, overflow: "hidden" },
  fill: { height: 4, borderRadius: radius.pill, backgroundColor: colors.accent },
  insight: { backgroundColor: colors.accentSoft, borderRadius: radius.card, padding: spacing.lg, gap: spacing.xs },
  accentLabel: { color: colors.accent },
  insightText: { fontSize: 18, fontFamily: fonts.semibold, lineHeight: 24, color: colors.text },
  section: { gap: spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  muted: { fontSize: 16, fontFamily: fonts.regular, lineHeight: 22, color: colors.muted },
  footer: { padding: spacing.screen, paddingTop: spacing.sm },
});
