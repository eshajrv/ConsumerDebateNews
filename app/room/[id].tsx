import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { dropInDuration, MiniScale } from "../../src/components/MiniScale";
import { type RoomMember, useLeaveRoom, usePingLobby, useRoom } from "../../src/data";
import { useSavedUserId } from "../../src/session";
import { card, colors, fonts, positionColor, spacing, type } from "../../src/theme";

// Same rules as checkStart in convex/rooms.ts
const MIN_SEATS = { duo: 2, group: 3 };
const MAX_SEATS = { duo: 2, group: 6 };
const MIN_SPREAD = 30;
const PING_MS = 15_000;

function Seat({ member, you }: { member?: RoomMember; you: boolean }) {
  const [pop] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const anim = Animated.spring(pop, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [pop]);

  if (!member) {
    return (
      <View style={styles.seat}>
        <View style={[styles.avatar, styles.emptyAvatar]} />
        <Text style={[styles.seatName, { color: colors.muted }]}>Open seat</Text>
      </View>
    );
  }
  return (
    <Animated.View style={[styles.seat, { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] }]}>
      <View style={[styles.avatar, { backgroundColor: positionColor(member.position) }, you && styles.youAvatar]}>
        <Text style={styles.initial}>{member.name.charAt(0).toUpperCase() || "?"}</Text>
      </View>
      <Text style={[styles.seatName, you && { color: colors.accent }]} numberOfLines={1}>
        {you ? "You" : member.name}
      </Text>
    </Animated.View>
  );
}

export default function RoomLobby() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useSavedUserId();
  const room = useRoom(id);
  const ping = usePingLobby();
  const leave = useLeaveRoom();
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

  // Keep this seat taken while the lobby is open; seats that stop pinging get cleared
  useEffect(() => {
    if (status !== "waiting" || !userId) return;
    const keepSeat = () => ping({ roomId: id, userId }).catch(() => {});
    keepSeat();
    const timer = setInterval(keepSeat, PING_MS);
    return () => clearInterval(timer);
  }, [status, userId, id, ping]);

  async function goBack() {
    if (status === "waiting" && userId) await leave({ roomId: id, userId }).catch(() => {});
    if (router.canGoBack()) router.back();
    else router.replace("/home");
  }

  if (!room) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        {room === undefined ? <ActivityIndicator color={colors.accent} /> : <Text style={type.body}>Table not found.</Text>}
      </SafeAreaView>
    );
  }

  const live = room.status === "live";
  const mode = room.mode ?? "group";
  const seated = room.members.length;
  const positions = room.members.map((m) => m.position);
  const viewsDiffer =
    seated > 0 && Math.max(...positions) - Math.min(...positions) >= MIN_SPREAD && (mode === "duo" || room.members.some((m) => m.band === "M"));
  const needed = MIN_SEATS[mode] - seated;
  const waitingLine =
    needed > 0
      ? `Waiting for ${needed} more ${needed === 1 ? "person" : "people"}`
      : viewsDiffer
        ? "Starting..."
        : mode === "duo"
          ? "Waiting for someone who sees it differently"
          : "Waiting for more different views (someone in the middle helps)";
  const seats = Array.from({ length: MAX_SEATS[mode] }, (_, i) => room.members[i]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <Pressable onPress={goBack} hitSlop={12} accessibilityRole="button">
          <Text style={styles.back}>{room.status === "waiting" ? "Leave lobby" : "Back"}</Text>
        </Pressable>
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
            <Text style={type.label}>{mode === "duo" ? "1-on-1 lobby" : "Group lobby"}</Text>
            <Text style={styles.countdown}>
              {seated}/{MAX_SEATS[mode]}
            </Text>
            <View style={styles.waitingRow}>
              <ActivityIndicator color={colors.accent} size="small" />
              <Text style={styles.waiting}>{waitingLine}</Text>
            </View>
            {mode === "group" && <Text style={styles.muted}>Starts at {MIN_SEATS.group} people, seats up to {MAX_SEATS.group}.</Text>}
          </View>
        )}

        <View style={[card, styles.membersCard]}>
          {live ? (
            <>
              <Text style={type.title}>{seated} at this table</Text>
              <MiniScale members={room.members} youId={userId} dropIn />
              <Text style={styles.muted}>Everyone&apos;s here.</Text>
            </>
          ) : (
            <>
              <View style={styles.seats}>
                {seats.map((m, i) => (
                  <Seat key={m ? m.userId : `open-${i}`} member={m} you={m?.userId === userId} />
                ))}
              </View>
              <Text style={styles.muted}>Stay on this screen. We&apos;ll take you in the moment it opens.</Text>
            </>
          )}
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
  membersCard: { gap: spacing.lg },
  back: { fontSize: 16, fontFamily: fonts.semibold, color: colors.accent },
  waitingRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  waiting: { fontSize: 16, fontFamily: fonts.semibold, color: colors.text },
  seats: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", rowGap: spacing.lg },
  seat: { width: "33%", alignItems: "center", gap: spacing.xs },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: colors.surface },
  emptyAvatar: { backgroundColor: "transparent", borderStyle: "dashed", borderColor: colors.border, borderWidth: 2 },
  youAvatar: { borderColor: colors.accent },
  initial: { fontSize: 22, fontFamily: fonts.bold, color: colors.surface },
  seatName: { fontSize: 14, fontFamily: fonts.semibold, color: colors.text, maxWidth: 90 },
  muted: { fontSize: 15, fontFamily: fonts.regular, color: colors.muted, textAlign: "center" },
});

export { RoomErrorBoundary as ErrorBoundary } from "../../src/components/RoomErrorBoundary";
