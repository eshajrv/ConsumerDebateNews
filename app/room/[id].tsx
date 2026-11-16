import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Animated, Easing, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BackButton } from "../../src/components/BackButton";
import { dropInDuration, MiniScale } from "../../src/components/MiniScale";
import { useRoom } from "../../src/data";
import { formatCountdown, formatTime, useNow } from "../../src/date";
import { useSavedUserId } from "../../src/session";
import { card, colors, fonts, spacing, type } from "../../src/theme";

export default function RoomLobby() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useSavedUserId();
  const room = useRoom(id);
  const now = useNow();
  const [starting] = useState(() => new Animated.Value(0));
  const [zoom] = useState(() => new Animated.Value(0));

  const status = room?.status;
  const memberCount = room?.members.length ?? 0;
  useEffect(() => {
    if (status === "summarizing" || status === "done") {
      router.replace(`/room/${id}/summary`);
      return;
    }
    if (status !== "live") return;
    // "Your room is starting" pops in while the members drop onto the scale, then the screen
    // scales up into the chat.
    const moment = Animated.sequence([
      Animated.spring(starting, { toValue: 1, useNativeDriver: true, friction: 5 }),
      Animated.delay(Math.max(0, dropInDuration(memberCount) - 300)),
      Animated.timing(zoom, { toValue: 1, duration: 320, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]);
    moment.start(({ finished }) => {
      if (finished) router.replace(`/room/${id}/chat`);
    });
    return () => moment.stop();
  }, [status, id, starting, zoom, memberCount]);

  if (!room) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        {room === undefined ? <ActivityIndicator color={colors.accent} /> : <Text style={type.body}>Table not found.</Text>}
      </SafeAreaView>
    );
  }

  const live = room.status === "live";

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <BackButton />
      </View>
      <Animated.View
        style={[
          styles.body,
          {
            opacity: zoom.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
            transform: [{ scale: zoom.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }],
          },
        ]}
      >
        {live ? (
          <Animated.View style={[styles.startingWrap, { opacity: starting, transform: [{ scale: starting.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]}>
            <Text style={styles.startingText}>Your table is ready</Text>
            <Text style={styles.muted}>Say hi. The host opens first.</Text>
          </Animated.View>
        ) : (
          <View style={styles.countdownWrap}>
            {room.status !== "rolled" && <Text style={type.title}>Waiting for the table to fill</Text>}
            <Text style={type.label}>
              {room.status !== "rolled" ? `Table opens at ${formatTime(room.slotStart)}` : room.slotStart > now ? `Moved to ${formatTime(room.slotStart)}` : "Moved to the next table"}
            </Text>
            {room.slotStart > now && <Text style={styles.countdown}>{formatCountdown(room.slotStart - now)}</Text>}
            {room.status === "rolled" && <Text style={styles.muted}>Not enough different views yet, so we moved you to the next table.</Text>}
          </View>
        )}

        <View style={[card, styles.membersCard]}>
          <Text style={type.title}>{room.members.length} at this table</Text>
          <MiniScale members={room.members} youId={userId} dropIn={live} />
          <Text style={styles.muted}>{live ? "Everyone's here." : "Tables open with 2+ people."}</Text>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: "center", justifyContent: "center" },
  top: { paddingHorizontal: spacing.screen, paddingTop: spacing.sm },
  body: { flex: 1, padding: spacing.screen, gap: spacing.xl, justifyContent: "center" },
  countdownWrap: { alignItems: "center", gap: spacing.sm },
  countdown: { fontSize: 64, fontFamily: fonts.bold, color: colors.text, fontVariant: ["tabular-nums"] },
  startingWrap: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.lg },
  startingText: { fontSize: 28, fontFamily: fonts.bold, color: colors.accent, textAlign: "center" },
  membersCard: { gap: spacing.md },
  muted: { fontSize: 15, fontFamily: fonts.regular, color: colors.muted, textAlign: "center" },
});

export { RoomErrorBoundary as ErrorBoundary } from "../../src/components/RoomErrorBoundary";
