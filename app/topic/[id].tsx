import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BackButton } from "../../src/components/BackButton";
import { SplitBar } from "../../src/components/SplitBar";
import { StanceSlider } from "../../src/components/StanceSlider";
import { type RoomMode, useFeed, useJoinRoom, useNextRoom, useSetStance, useTopicStats } from "../../src/data";
import { formatTime, pacificDate, todayString } from "../../src/date";
import { useSavedUserId } from "../../src/session";
import { colors, radius, spacing, type } from "../../src/theme";

const OPTIONS: { mode: RoomMode; title: string; subtitle: string }[] = [
  { mode: "oneOnOne", title: "1-on-1", subtitle: "Talk with one person who sees it differently" },
  { mode: "group", title: "Group", subtitle: "Up to 6 people across the spectrum" },
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
          <Text style={styles.optionNext}>{next ? `${formatTime(next.slot)} room · ${next.joinedCount} joined` : " "}</Text>
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
  const [saved, setSaved] = useState(false);
  const [joining, setJoining] = useState<RoomMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async (value: number) => {
    if (!userId) return;
    await setStance({ userId, topicId: id, position: value, today: todayString() });
    setSaved(true);
  };

  async function join(mode: RoomMode) {
    if (!userId) return;
    setJoining(mode);
    setError(null);
    try {
      if (!saved) await save(position);
      const roomId = await joinRoom({ userId, topicId: id, mode });
      router.push(`/room/${roomId}`);
    } catch {
      setError("Couldn't join the room. Try again.");
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
        <Text style={[type.label, topic.isShared && { color: colors.accent }]}>
          {topic.isShared ? "Topic of the day" : topic.category.charAt(0).toUpperCase() + topic.category.slice(1)}
        </Text>
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

        {topic.sources.length > 0 && <Text style={styles.sources}>Sources: {topic.sources.join(", ")}</Text>}

        <View style={styles.take}>
          <Text style={type.title}>Where do you land?</Text>
          <StanceSlider
            value={position}
            sideA={topic.sideA}
            sideB={topic.sideB}
            onChange={(v) => {
              setPosition(v);
              setSaved(false);
            }}
            onRelease={save}
          />
          <Text style={styles.saved}>{saved ? "Your take is saved." : " "}</Text>
        </View>

        <View style={styles.take}>
          <Text style={type.label}>How everyone leans</Text>
          <SplitBar stats={stats} sideA={topic.sideA} sideB={topic.sideB} />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {error && <Text style={styles.error}>{error}</Text>}
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
  sideName: { fontSize: 17, fontWeight: "800" },
  sources: { fontSize: 13, color: colors.muted },
  take: { gap: spacing.md, marginTop: spacing.md },
  saved: { fontSize: 14, color: colors.muted },
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
  optionTitle: { color: colors.onAccent, fontSize: 17, fontWeight: "700" },
  optionSubtitle: { color: colors.onAccent, fontSize: 14, textAlign: "center", opacity: 0.9 },
  optionNext: { color: colors.onAccent, fontSize: 13, fontWeight: "600", opacity: 0.75, fontVariant: ["tabular-nums"] },
  error: { fontSize: 15, color: colors.error, textAlign: "center" },
});
