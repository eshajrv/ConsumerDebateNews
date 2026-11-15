import { router } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Bell } from "../src/components/Bell";
import { Eye } from "../src/components/Eye";
import { SplitBar } from "../src/components/SplitBar";
import { Trophy } from "../src/components/Trophy";
import { type Topic, useFeed, useNextRoom, useNotifications, useTopicStats, useUser } from "../src/data";
import { formatTime, pacificDate } from "../src/date";
import { clearUserId, useSavedUserId } from "../src/session";
import { card, colors, spacing, type } from "../src/theme";

function TopicCard({ topic }: { topic: Topic }) {
  const stats = useTopicStats(topic._id);
  const next = useNextRoom(topic._id);
  return (
    <Pressable
      onPress={() => router.push(`/topic/${topic._id}`)}
      style={({ pressed }) => [card, styles.card, topic.isShared && styles.shared, pressed && styles.pressed]}
    >
      <Text style={[type.label, topic.isShared && styles.sharedLabel]}>
        {topic.isShared ? "Topic of the day" : topic.category.charAt(0).toUpperCase() + topic.category.slice(1)}
      </Text>
      <Text style={styles.question}>{topic.question}</Text>
      <SplitBar stats={stats} sideA={topic.sideA} sideB={topic.sideB} />
      <Text style={styles.next}>{next ? `Next room ${formatTime(next.slot)} · ${next.joinedCount} joined` : " "}</Text>
    </Pressable>
  );
}

export default function Home() {
  const userId = useSavedUserId();
  const user = useUser(userId);
  const topics = useFeed(userId, pacificDate());
  const notifications = useNotifications(userId);
  const unread = notifications?.filter((n) => !n.read).length ?? 0;
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
            <Text style={type.label}>{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</Text>
            <Text style={type.question}>{user ? `${greeting}, ${user.name}` : greeting}</Text>
          </View>
          <Trophy onPress={() => router.push("/leaderboard")} />
          <Eye onPress={() => router.push("/watch")} />
          <Bell count={unread} onPress={() => router.push("/inbox")} />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  header: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, marginBottom: spacing.sm },
  flex: { flex: 1, gap: spacing.xs },
  card: { gap: spacing.md },
  shared: { borderColor: colors.accent, borderWidth: 1.5 },
  sharedLabel: { color: colors.accent },
  pressed: { opacity: 0.8 },
  question: { fontSize: 22, lineHeight: 28, fontWeight: "700", color: colors.text },
  next: { fontSize: 14, color: colors.muted, fontWeight: "500" },
  muted: { fontSize: 16, color: colors.muted },
  startOver: { alignSelf: "center", paddingVertical: spacing.lg },
});
