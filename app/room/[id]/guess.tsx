import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../../../src/components/Button";
import { type GuessPick, useGuessSummary, useRateSummary, useRoomSummaries } from "../../../src/data";
import { useSavedUserId } from "../../../src/session";
import { card, colors, fonts, radius, spacing, type } from "../../../src/theme";

type FlipCardProps = {
  letter: string;
  text: string;
  flip: Animated.Value;
  revealed: boolean;
  isHuman: boolean;
  authorName: string;
  picked: boolean;
  disabled: boolean;
  onPress: () => void;
};

function FlipCard({ letter, text, flip, revealed, isHuman, authorName, picked, disabled, onPress }: FlipCardProps) {
  const lift = flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.94, 1] });
  const front = {
    opacity: flip.interpolate({ inputRange: [0, 0.5, 0.5001, 1], outputRange: [1, 1, 0, 0] }),
    transform: [{ perspective: 1200 }, { rotateY: flip.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] }) }, { scale: lift }],
  };
  const back = {
    opacity: flip.interpolate({ inputRange: [0, 0.5, 0.5001, 1], outputRange: [0, 0, 1, 1] }),
    transform: [{ perspective: 1200 }, { rotateY: flip.interpolate({ inputRange: [0, 1], outputRange: ["180deg", "360deg"] }) }, { scale: lift }],
  };
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={`Summary ${letter}`}>
      <Animated.View style={[card, styles.face, picked && styles.picked, front]}>
        <View style={styles.faceHeader}>
          <View style={[styles.badge, styles.letterBadge, picked && styles.letterBadgePicked]}>
            <Text style={[styles.badgeText, styles.letterBadgeText, picked && { color: colors.onAccent }]}>{letter}</Text>
          </View>
          {picked && <Text style={styles.byline}>Your guess</Text>}
        </View>
        <Text style={type.body}>{text}</Text>
      </Animated.View>
      <Animated.View
        pointerEvents={revealed ? "auto" : "none"}
        style={[card, styles.face, styles.back, isHuman ? styles.human : styles.ai, back]}
      >
        <View style={styles.faceHeader}>
          <View style={[styles.badge, isHuman ? styles.humanBadge : styles.aiBadge]}>
            <Text style={[styles.badgeText, { color: colors.onAccent }]}>{isHuman ? "HUMAN" : "AI"}</Text>
          </View>
          <Text style={[styles.byline, isHuman && { color: colors.accent }]} numberOfLines={1}>
            {isHuman ? `${authorName} wrote this` : "Written by the AI"}
          </Text>
        </View>
        <Text style={type.body}>{text}</Text>
      </Animated.View>
    </Pressable>
  );
}

export default function GuessAndRate() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useSavedUserId();
  const data = useRoomSummaries(id, userId);
  const guess = useGuessSummary();
  const rate = useRateSummary();
  const [pick, setPick] = useState<GuessPick | null>(null);
  const [stars, setStars] = useState(0);
  const [rating, setRating] = useState(false);
  const [flipA] = useState(() => new Animated.Value(0));
  const [flipB] = useState(() => new Animated.Value(0));

  const mine = data?.summaries.find((s) => s.aboutMe);
  const revealed = !!mine?.guessed && mine.humanIs !== null;

  useEffect(() => {
    if (!revealed) return;
    Animated.stagger(180, [
      Animated.timing(flipA, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.timing(flipB, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [revealed, flipA, flipB]);

  if (!data || !userId) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        {data === null ? <Text style={type.body}>Table not found.</Text> : <ActivityIndicator color={colors.accent} />}
      </SafeAreaView>
    );
  }

  if (!mine?.ready || !mine.options) {
    return (
      <SafeAreaView style={[styles.safe, styles.center, styles.padded]}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={type.title}>Waiting for the others...</Text>
      </SafeAreaView>
    );
  }

  const summary = mine;
  const authorName = summary.authorName || "Someone";
  const rated = summary.gotMeRating !== null;
  const shownStars = summary.gotMeRating ?? stars;
  const myPick = (summary.subjectGuess as GuessPick | null) ?? pick;

  async function choose(which: GuessPick) {
    if (summary.guessed || pick || !userId) return;
    setPick(which);
    try {
      await guess({ summaryId: summary._id, userId, pick: which });
    } catch {
      setPick(null);
    }
  }

  async function sendRating() {
    if (!stars || !userId) return;
    setRating(true);
    try {
      await rate({ summaryId: summary._id, userId, gotMeRating: stars });
    } finally {
      setRating(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={type.label}>Here&apos;s what they heard</Text>
        <Text style={type.question}>Which one did a person write?</Text>
        <Text style={styles.muted}>Both describe your view. One is from someone at your table, one is from the AI.</Text>

        {(["first", "second"] as const).map((which, i) => (
          <FlipCard
            key={which}
            letter={i === 0 ? "A" : "B"}
            text={summary.options![i]}
            flip={i === 0 ? flipA : flipB}
            revealed={revealed}
            isHuman={summary.humanIs === which}
            authorName={authorName}
            picked={myPick === which}
            disabled={summary.guessed || !!pick}
            onPress={() => choose(which)}
          />
        ))}

        {revealed && myPick && (
          <Text style={styles.verdict}>
            {myPick === summary.humanIs ? "You spotted the human." : `You couldn't tell! ${authorName} gets +20.`}
          </Text>
        )}

        {revealed && (
          <View style={styles.rateBlock}>
            <Text style={type.title}>Did they get you?</Text>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable
                  key={n}
                  onPress={() => setStars(n)}
                  disabled={rated}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`${n} star${n > 1 ? "s" : ""}`}
                >
                  <Text style={[styles.star, n <= shownStars && styles.starOn]}>{n <= shownStars ? "★" : "☆"}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {data.agreementLine && (
          <View style={styles.agreement}>
            <Text style={type.label}>Where the group agreed</Text>
            <Text style={styles.agreementText}>{data.agreementLine}</Text>
          </View>
        )}
      </ScrollView>

      {revealed && (
        <View style={styles.footer}>
          {rated ? (
            <Button title="See your results" onPress={() => router.replace(`/room/${id}/results`)} />
          ) : (
            <Button title="Rate" onPress={sendRating} disabled={!stars} loading={rating} />
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: "center", justifyContent: "center", gap: spacing.md },
  padded: { padding: spacing.screen },
  content: { padding: spacing.screen, gap: spacing.lg },
  muted: { fontSize: 16, fontFamily: fonts.regular, lineHeight: 22, color: colors.muted },
  face: { gap: spacing.md, padding: spacing.md + 4, borderWidth: 2, backfaceVisibility: "hidden" },
  back: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  picked: { borderColor: colors.accent },
  human: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  ai: { backgroundColor: colors.surface, borderColor: colors.border },
  faceHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, height: 36 },
  badge: { height: 36, minWidth: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  badgeText: { fontSize: 18, fontFamily: fonts.bold, letterSpacing: 1 },
  letterBadge: { paddingHorizontal: 0, backgroundColor: colors.surface },
  letterBadgePicked: { backgroundColor: colors.accent },
  letterBadgeText: { color: colors.text, letterSpacing: 0 },
  humanBadge: { backgroundColor: colors.accent },
  aiBadge: { backgroundColor: colors.muted },
  byline: { flex: 1, fontSize: 16, fontFamily: fonts.bold, color: colors.muted },
  verdict: { fontSize: 18, fontFamily: fonts.bold, color: colors.accent, textAlign: "center" },
  rateBlock: { alignItems: "center", gap: spacing.sm },
  stars: { flexDirection: "row", gap: spacing.sm },
  star: { fontSize: 40, fontFamily: fonts.regular, color: colors.border },
  starOn: { color: colors.accent },
  agreement: { padding: spacing.md, borderRadius: radius.card, backgroundColor: colors.surface, gap: spacing.xs },
  agreementText: { fontSize: 16, fontFamily: fonts.regular, lineHeight: 22, color: colors.text, fontStyle: "italic" },
  footer: { padding: spacing.screen, paddingTop: spacing.sm },
});

export { RoomErrorBoundary as ErrorBoundary } from "../../../src/components/RoomErrorBoundary";
