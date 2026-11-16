import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BackButton } from "../../src/components/BackButton";
import { Button } from "../../src/components/Button";
import { SplitBar } from "../../src/components/SplitBar";
import { StanceSlider } from "../../src/components/StanceSlider";
import { type RoomMode, useFeed, useJoinRoom, useNextRoom, useSetStance, useTopicStats } from "../../src/data";
import { pacificDate, todayString } from "../../src/date";
import { useSavedUserId } from "../../src/session";
import { colors, fonts, radius, spacing, type } from "../../src/theme";

const OPTIONS: { mode: RoomMode; title: string; subtitle: string }[] = [
  { mode: "duo", title: "Pull up a chair: 1-on-1", subtitle: "A table for two with someone who sees it differently" },
  { mode: "group", title: "Pull up a chair: group", subtitle: "A table of up to 6 across the spectrum" },
];

function JoinOption({
  topicId,
  option,
  loading,
  disabled,
  onPress,
}: {
  topicId: string;
  option: (typeof OPTIONS)[number];
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const next = useNextRoom(topicId, option.mode);
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off }}
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [styles.option, disabled && !loading && styles.optionDisabled, pressed && styles.optionPressed]}
    >
      {loading ? (
        <ActivityIndicator color={colors.onAccent} />
      ) : (
        <>
          <Text style={styles.optionTitle}>{option.title}</Text>
          <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
          <Text style={styles.optionNext}>{next ? (next.joinedCount ? `${next.joinedCount} waiting at the table` : "Be the first to sit down") : " "}</Text>
        </>
      )}
    </Pressable>
  );
}

export default function TopicScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useSavedUserId();
  const topics = useFeed(userId, pacificDate());
  const topic = topics?.find((t) => t._id === id);
  const stats = useTopicStats(id);
  const setStance = useSetStance();
  const joinRoom = useJoinRoom();

  const [position, setPosition] = useState(50);
  const [touched, setTouched] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [joining, setJoining] = useState<RoomMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = (value: number) => {
    setPosition(value);
    setTouched(true);
  };

  async function saveTake() {
    if (!userId) return;
    setSaving(true);
    setError(null);
    try {
      await setStance({ userId, topicId: id, position, today: todayString() });
      setSaved(true);
    } catch {
      setError("Couldn't save your take. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function join(mode: RoomMode) {
    if (!userId) return;
    setJoining(mode);
    setError(null);
    try {
      const roomId = await joinRoom({ userId, topicId: id, mode });
      router.push(`/room/${roomId}`);
    } catch {
      setError("Couldn't get you a seat. Try again.");
    } finally {
      setJoining(null);
    }
  }

  if (!topic) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        {topics === undefined ? <ActivityIndicator color={colors.accent} /> : <Text style={type.body}>Topic not found.</Text>}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <BackButton />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={type.category}>{topic.isShared ? "The house table" : topic.category}</Text>
        <Text style={type.question}>{topic.question}</Text>
        <Text style={type.body}>{topic.brief}</Text>

        <View style={[styles.side, { backgroundColor: colors.sideASoft }]}>
          <Text style={[styles.sideName, { color: colors.sideA }]}>{topic.sideA}</Text>
          <Text style={type.body}>{topic.sideAView}</Text>
        </View>
        <View style={[styles.side, { backgroundColor: colors.sideBSoft }]}>
          <Text style={[styles.sideName, { color: colors.sideB }]}>{topic.sideB}</Text>
          <Text style={type.body}>{topic.sideBView}</Text>
        </View>

        {topic.sources.length > 0 && (
          <Text style={styles.sources}>
            Sources:{" "}
            {topic.sources.map((source, i) => {
              const url = /^https?:\/\//.test(source) ? source : null;
              const label = url ? new URL(url).hostname.replace(/^www\./, "") : source;
              return (
                <Text key={source}>
                  {i > 0 && " · "}
                  {url ? (
                    <Text style={styles.sourceLink} onPress={() => Linking.openURL(url)} accessibilityRole="link">
                      {label}
                    </Text>
                  ) : (
                    label
                  )}
                </Text>
              );
            })}
          </Text>
        )}

        <View style={styles.take}>
          <Text style={type.label}>How everyone leans</Text>
          <SplitBar stats={stats} sideA={topic.sideA} sideB={topic.sideB} />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {error && <Text style={styles.error}>{error}</Text>}
        {!saved ? (
          <>
            <Text style={type.title}>Where do you land?</Text>
            <StanceSlider value={position} sideA={topic.sideA} sideB={topic.sideB} onChange={pick} onRelease={pick} />
            <Button title={touched ? "Save my take" : "Move the slider to answer"} disabled={!touched} loading={saving} onPress={saveTake} />
          </>
        ) : (
          <>
            <View style={styles.savedRow}>
              <Text style={styles.saved}>Your take is saved.</Text>
              <Pressable onPress={() => setSaved(false)} disabled={joining !== null} hitSlop={12} accessibilityRole="button">
                <Text style={styles.change}>Change</Text>
              </Pressable>
            </View>
            {OPTIONS.map((option) => (
              <JoinOption
                key={option.mode}
                topicId={id}
                option={option}
                loading={joining === option.mode}
                disabled={joining !== null}
                onPress={() => join(option.mode)}
              />
            ))}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: "center", justifyContent: "center" },
  top: { paddingHorizontal: spacing.screen, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  content: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xl, gap: spacing.md },
  side: { borderRadius: radius.card, padding: spacing.lg, gap: spacing.sm },
  sideName: { fontSize: 17, fontFamily: fonts.bold },
  sources: { fontSize: 13, fontFamily: fonts.regular, color: colors.muted },
  sourceLink: { fontFamily: fonts.semibold, color: colors.accent, textDecorationLine: "underline" },
  take: { gap: spacing.md, marginTop: spacing.md },
  savedRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  saved: { fontSize: 14, fontFamily: fonts.regular, color: colors.muted },
  change: { fontSize: 14, fontFamily: fonts.semibold, color: colors.accent },
  footer: { padding: spacing.screen, paddingTop: spacing.sm, gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  option: {
    backgroundColor: colors.accent,
    borderRadius: radius.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 84,
    gap: 2,
  },
  optionDisabled: { opacity: 0.4 },
  optionPressed: { opacity: 0.85 },
  optionTitle: { color: colors.onAccent, fontSize: 17, fontFamily: fonts.display },
  optionSubtitle: { color: colors.onAccent, fontSize: 14, fontFamily: fonts.regular, textAlign: "center", opacity: 0.9 },
  optionNext: { color: colors.onAccent, fontSize: 13, fontFamily: fonts.semibold, opacity: 0.75, fontVariant: ["tabular-nums"] },
  error: { fontSize: 15, fontFamily: fonts.regular, color: colors.error, textAlign: "center" },
});
