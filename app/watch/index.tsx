import { router } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BackButton } from "../../src/components/BackButton";
import { MiniScale } from "../../src/components/MiniScale";
import { type LiveRoom, useLiveRooms } from "../../src/data";
import { formatCountdown, useNow } from "../../src/date";
import { card, colors, spacing, type } from "../../src/theme";

function LiveRoomCard({ room, now }: { room: LiveRoom; now: number }) {
  const members = room.members.map((m, i) => ({ ...m, userId: `${room._id}_${i}` }));
  return (
    <Pressable
      onPress={() => router.push(`/watch/${room._id}`)}
      accessibilityRole="button"
      style={({ pressed }) => [card, styles.card, pressed && styles.pressed]}
    >
      <View style={styles.row}>
        <View style={styles.liveDot} />
        <Text style={styles.live}>Live</Text>
        <Text style={styles.time}>{room.endsAt ? `${formatCountdown(room.endsAt - now)} left` : ""}</Text>
      </View>
      <Text style={styles.question}>{room.question}</Text>
      <View style={styles.scale}>
        <MiniScale members={members} youId={null} />
      </View>
    </Pressable>
  );
}

export default function WatchLive() {
  const rooms = useLiveRooms();
  const now = useNow();
  const watchable = rooms?.filter((r) => !r.endsAt || r.endsAt > now);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <BackButton />
      </View>
      <View style={styles.header}>
        <Text style={type.question}>Watch live</Text>
        <Text style={styles.muted}>Rooms where everyone said it&apos;s okay to watch.</Text>
      </View>
      {watchable === undefined ? (
        <ActivityIndicator color={colors.accent} style={styles.loading} />
      ) : (
        <FlatList
          data={watchable}
          keyExtractor={(r) => r._id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No rooms are live right now. Check back at the next slot.</Text>}
          renderItem={({ item }) => <LiveRoomCard room={item} now={now} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  top: { paddingHorizontal: spacing.screen, paddingTop: spacing.sm },
  header: { paddingHorizontal: spacing.screen, paddingTop: spacing.md, gap: spacing.xs },
  muted: { fontSize: 15, color: colors.muted },
  loading: { marginTop: spacing.xl },
  list: { padding: spacing.screen, gap: spacing.md },
  empty: { fontSize: 16, color: colors.muted, textAlign: "center", marginTop: spacing.xl },
  card: { gap: spacing.sm, paddingHorizontal: 0 },
  pressed: { opacity: 0.8 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.lg },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.sideA },
  live: { fontSize: 13, fontWeight: "700", color: colors.sideA, flex: 1 },
  time: { fontSize: 14, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] },
  question: { fontSize: 20, lineHeight: 26, fontWeight: "700", color: colors.text, paddingHorizontal: spacing.lg },
  scale: { marginTop: -spacing.xs },
});
