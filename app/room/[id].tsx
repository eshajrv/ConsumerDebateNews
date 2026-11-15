import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Animated, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BackButton } from "../../src/components/BackButton";
import { MiniScale } from "../../src/components/MiniScale";
import { useRoom } from "../../src/data";
import { formatCountdown, formatTime, useNow } from "../../src/date";
import { useSavedUserId } from "../../src/session";
import { card, colors, spacing, type } from "../../src/theme";

export default function RoomLobby() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useSavedUserId();
  const room = useRoom(id);
  const now = useNow();
  const [starting] = useState(() => new Animated.Value(0));

  const status = room?.status;
  useEffect(() => {
    if (status === "summarizing" || status === "done") {
      router.replace(`/room/${id}/summary`);
    } else if (status === "live") {
      Animated.spring(starting, { toValue: 1, useNativeDriver: true, friction: 5 }).start();
      const t = setTimeout(() => router.replace(`/room/${id}/chat`), 1400);
      return () => clearTimeout(t);
    }
  }, [status, id, starting]);

  if (!room) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        {room === undefined ? <ActivityIndicator color={colors.accent} /> : <Text style={type.body}>Room not found.</Text>}
      </SafeAreaView>
    );
  }

  const live = room.status === "live";

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <BackButton />
      </View>
      <View style={styles.body}>
        {live ? (
          <Animated.View style={[styles.startingWrap, { opacity: starting, transform: [{ scale: starting.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]}>
            <Text style={styles.startingText}>Your room is starting</Text>
            <Text style={styles.muted}>Say hi. The judge opens first.</Text>
          </Animated.View>
        ) : (
          <View style={styles.countdownWrap}>
            <Text style={type.label}>
              {room.status !== "rolled" ? `Room starts at ${formatTime(room.slotStart)}` : room.slotStart > now ? `Moved to ${formatTime(room.slotStart)}` : "Moved to the next room"}
            </Text>
            {room.slotStart > now && <Text style={styles.countdown}>{formatCountdown(room.slotStart - now)}</Text>}
            {room.status === "rolled" && <Text style={styles.muted}>Not enough different views yet, so we moved you to the next room.</Text>}
          </View>
        )}

        <View style={[card, styles.membersCard]}>
          <Text style={type.title}>{room.members.length} in this room</Text>
          <MiniScale members={room.members} youId={userId} />
          <Text style={styles.muted}>Rooms start with 3+ people.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: "center", justifyContent: "center" },
  top: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  body: { flex: 1, padding: spacing.lg, gap: spacing.xl, justifyContent: "center" },
  countdownWrap: { alignItems: "center", gap: spacing.sm },
  countdown: { fontSize: 64, fontWeight: "800", color: colors.text, fontVariant: ["tabular-nums"] },
  startingWrap: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.lg },
  startingText: { fontSize: 28, fontWeight: "800", color: colors.accent, textAlign: "center" },
  membersCard: { gap: spacing.md },
  muted: { fontSize: 15, color: colors.muted, textAlign: "center" },
});
