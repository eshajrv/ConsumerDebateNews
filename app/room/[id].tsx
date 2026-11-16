import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Animated, Easing, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BackButton } from "../../src/components/BackButton";
import { dropInDuration } from "../../src/components/MiniScale";
import { SeatTable } from "../../src/components/SeatTable";
import { TopicPhoto } from "../../src/components/TopicPhoto";
import { useRoom } from "../../src/data";
import { useSavedUserId } from "../../src/session";
import { card, colors, fonts, spacing, type } from "../../src/theme";

export default function RoomLobby() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useSavedUserId();
  const room = useRoom(id);
  const [starting] = useState(() => new Animated.Value(0));
  const [zoom] = useState(() => new Animated.Value(0));

  const status = room?.status;
  const memberCount = room?.members.length ?? 0;
  const movedTo = room?.members.find((m) => m.userId === userId)?.movedToRoomId ?? room?.movedToRoomId;
  useEffect(() => {
    if (status === "rolled" && movedTo) {
      router.replace(`/room/${movedTo}`);
      return;
    }
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
  }, [status, id, starting, zoom, memberCount, movedTo]);

  if (!room) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        {room === undefined ? <ActivityIndicator color={colors.accent} /> : <Text style={type.body}>Table not found.</Text>}
      </SafeAreaView>
    );
  }

  const live = room.status === "live";
  const duo = room.mode === "duo";

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
            <Text style={type.title}>Waiting for people to sit down</Text>
            <Text style={styles.countdown}>
              {room.members.length}/{duo ? 2 : 6}
            </Text>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.muted}>
              {duo
                ? "Your table opens as soon as someone who sees it differently sits down."
                : "Your table opens once people with different views are here."}
            </Text>
          </View>
        )}

        <View style={[card, styles.membersCard]}>
          {room.topic && (
            <>
              <TopicPhoto imageUrl={room.topic.imageUrl} category={room.topic.category} bleed={{ top: card.padding, horizontal: card.padding }} />
              <Text style={type.title}>{room.topic.question}</Text>
            </>
          )}
          <Text style={type.label}>{room.members.length} at this table</Text>
          <SeatTable
            members={room.members}
            youId={userId}
            seats={duo ? 2 : 6}
            sideA={room.topic?.sideA}
            sideB={room.topic?.sideB}
          />
          <Text style={styles.muted}>{live ? "Everyone's here." : "Stay on this screen. We'll take you in when it opens."}</Text>
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
  membersCard: { gap: spacing.md, overflow: "hidden" },
  muted: { fontSize: 15, fontFamily: fonts.regular, color: colors.muted, textAlign: "center" },
});

export { RoomErrorBoundary as ErrorBoundary } from "../../src/components/RoomErrorBoundary";
