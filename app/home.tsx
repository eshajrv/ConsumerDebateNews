import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Bell } from "../src/components/Bell";
import { Button } from "../src/components/Button";
import { Eye } from "../src/components/Eye";
import { ProfileButton } from "../src/components/ProfileButton";
import { SplitBar } from "../src/components/SplitBar";
import { TopicPhoto } from "../src/components/TopicPhoto";
import { Toast } from "../src/components/Toast";
import { Trophy } from "../src/components/Trophy";
import { type Topic, useFeed, useNextRoom, useNotifications, useTopicStats, useUser } from "../src/data";
import { pacificDate } from "../src/date";
import { clearUserId, useSavedUserId } from "../src/session";
import { card, colors, fonts, spacing, type } from "../src/theme";

// The shared topic: a deep green card with a brass border
function HouseTableCard({ topic }: { topic: Topic }) {
  const stats = useTopicStats(topic._id);
  const next = useNextRoom(topic._id);
  const open = () => router.push(`/topic/${topic._id}`);
  return (
    <Pressable onPress={open} style={({ pressed }) => [card, styles.card, styles.house, pressed && styles.pressed]}>
      <TopicPhoto imageUrl={topic.imageUrl} category={topic.category} fade bleed={{ top: card.padding, horizontal: card.padding }} />
      <Text style={[type.category, styles.houseLabel]}>The house table</Text>
      <Text style={[styles.question, styles.houseQuestion]}>{topic.question}</Text>
      <SplitBar stats={stats} sideA={topic.sideA} sideB={topic.sideB} onDark />
      <View style={styles.password}>
        <Text style={styles.passwordLabel}>Next table</Text>
        <Text style={styles.passwordValue}>
          {next ? (next.joinedCount ? `${next.joinedCount} waiting at the table` : "No one waiting yet") : " "}
        </Text>
      </View>
      <Button title="Pull up a chair" variant="feature" onPress={open} />
    </Pressable>
  );
}

function TopicCard({ topic }: { topic: Topic }) {
  const stats = useTopicStats(topic._id);
  const next = useNextRoom(topic._id);
  if (topic.isShared) return <HouseTableCard topic={topic} />;
  return (
    <Pressable
      onPress={() => router.push(`/topic/${topic._id}`)}
      style={({ pressed }) => [card, styles.card, pressed && styles.pressed]}
    >
      <TopicPhoto imageUrl={topic.imageUrl} category={topic.category} bleed={{ top: card.padding, horizontal: card.padding }} />
      <Text style={type.category}>{topic.category}</Text>
      <Text style={styles.question}>{topic.question}</Text>
      <SplitBar stats={stats} sideA={topic.sideA} sideB={topic.sideB} />
      <Text style={styles.next}>{next ? (next.joinedCount ? `${next.joinedCount} waiting at the table` : "No one waiting yet") : " "}</Text>
    </Pressable>
  );
}

export default function Home() {
  const { left } = useLocalSearchParams<{ left?: string }>();
  const userId = useSavedUserId();
  const user = useUser(userId);
  const topics = useFeed(userId, pacificDate());
  const notifications = useNotifications(userId);
  const unread = notifications?.unreadCount ?? 0;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  async function startOver() {
    await clearUserId();
    router.replace("/onboarding");
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.flex}>
            <Text style={styles.wordmark}>speak-easy</Text>
            <Text style={type.label}>{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</Text>
            <Text style={type.question}>{user ? `${greeting}, ${user.name}` : greeting}</Text>
          </View>
          <Trophy onPress={() => router.push("/leaderboard")} />
          <Eye onPress={() => router.push("/watch")} />
          <Bell count={unread} onPress={() => router.push("/inbox")} />
          <ProfileButton name={user?.name} onPress={() => router.push("/profile")} />
        </View>

        {topics === undefined ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          topics.map((t) => <TopicCard key={t._id} topic={t} />)
        )}

        <Pressable onPress={startOver} hitSlop={12} style={styles.startOver}>
          <Text style={styles.muted}>Start over</Text>
        </Pressable>
      </ScrollView>
      {left && <Toast message="You left the room. -10 points" />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.screen, gap: spacing.md },
  header: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, marginBottom: spacing.sm },
  flex: { flex: 1, gap: spacing.xs },
  card: { gap: spacing.md, overflow: "hidden" },
  wordmark: { fontFamily: fonts.wordmark, fontSize: 28, lineHeight: 34, color: colors.feature },
  house: { backgroundColor: colors.feature, borderColor: colors.accent, borderWidth: 1, overflow: "hidden" },
  houseLabel: { color: colors.featureAccent },
  houseQuestion: { color: colors.featureText },
  password: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: colors.featureAccent,
    paddingVertical: spacing.sm,
  },
  passwordLabel: { ...type.category, color: colors.featureAccent },
  passwordValue: { fontSize: 14, fontFamily: fonts.medium, color: colors.featureText },
  pressed: { opacity: 0.8 },
  question: { fontSize: 22, fontFamily: fonts.display, lineHeight: 28, color: colors.text },
  next: { fontSize: 14, fontFamily: fonts.medium, color: colors.muted },
  muted: { fontSize: 16, fontFamily: fonts.regular, color: colors.muted },
  startOver: { alignSelf: "center", paddingVertical: spacing.lg },
});
