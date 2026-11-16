import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Platform, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../../src/components/Button";
import { LeaveButton, LeaveConfirmModal } from "../../src/components/LeaveConfirm";
import { dropInDuration } from "../../src/components/MiniScale";
import { SeatTable } from "../../src/components/SeatTable";
import { TopicPhoto } from "../../src/components/TopicPhoto";
import { useLeaveRoom, usePingLobby, useRoom, useStartNow } from "../../src/data";
import { errorMessage } from "../../src/errors";
import { clearSavedRoomId, saveRoomId, useSavedUserId } from "../../src/session";
import { card, colors, fonts, spacing, type } from "../../src/theme";

// Same rules as convex/rooms.ts
const MIN_SEATS = { duo: 2, group: 3 };
const MAX_SEATS = { duo: 2, group: 6 };
const PING_MS = 5_000;

export default function RoomLobby() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useSavedUserId();
  const room = useRoom(id);
  const ping = usePingLobby();
  const leave = useLeaveRoom();
  const startNow = useStartNow();
  const [startingNow, setStartingNow] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
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
    if (status !== "waiting" || !userId || leaving) return;
    const keepSeat = () => ping({ roomId: id, userId }).catch(() => {});
    keepSeat();
    const timer = setInterval(keepSeat, PING_MS);
    pingTimer.current = timer;
    // On the web, closing the tab gives up the seat right away
    const giveUpSeat = () => {
      leave({ roomId: id, userId }).catch(() => {});
    };
    if (Platform.OS === "web") window.addEventListener("pagehide", giveUpSeat);
    return () => {
      clearInterval(timer);
      pingTimer.current = null;
      if (Platform.OS === "web") window.removeEventListener("pagehide", giveUpSeat);
    };
  }, [status, userId, id, ping, leave, leaving]);

  // Remember this table while you're seated, so reopening the app comes back here
  const amSeated = !!room?.members.some((m) => m.userId === userId);
  useEffect(() => {
    if (!status || !userId) return;
    if ((status === "waiting" || status === "live") && amSeated) saveRoomId(id);
    else clearSavedRoomId();
  }, [status, amSeated, userId, id]);

  async function leaveLobby() {
    if (!userId || leaving) return;
    // The table may have opened while the modal was up; leaving then costs points, so let the
    // lobby carry on into the chat instead
    if (status !== "waiting") {
      setConfirmLeave(false);
      return;
    }
    setLeaving(true);
    setLeaveError(null);
    if (pingTimer.current) clearInterval(pingTimer.current);
    pingTimer.current = null;
    try {
      await leave({ roomId: id, userId });
      await clearSavedRoomId();
      router.replace("/home");
    } catch (e) {
      setLeaving(false);
      setLeaveError(errorMessage(e, "Couldn't leave the lobby. Try again."));
    }
  }

  function closeLeave() {
    if (leaving) return;
    setConfirmLeave(false);
    setLeaveError(null);
  }

  async function start() {
    if (!userId) return;
    setStartingNow(true);
    setStartError(null);
    try {
      await startNow({ roomId: id, userId });
    } catch (e) {
      setStartError(errorMessage(e, "Couldn't start the table. Try again."));
      setStartingNow(false);
    }
  }

  if (!room) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        {room === undefined ? <ActivityIndicator color={colors.accent} /> : <Text style={type.body}>Table not found.</Text>}
      </SafeAreaView>
    );
  }

  const live = room.status === "live";
  const duo = room.mode === "duo";
  const mode = duo ? "duo" : "group";
  const seated = room.members.length;
  const needed = MIN_SEATS[mode] - seated;
  const canStart = !duo && needed <= 0;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        {room.status === "waiting" ? (
          <LeaveButton label="‹ Leave lobby" accessibilityLabel="Leave the lobby" onPress={() => setConfirmLeave(true)} />
        ) : (
          <LeaveButton label="‹ Back" accessibilityLabel="Back to home" onPress={() => router.replace("/home")} />
        )}
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
              {seated}/{MAX_SEATS[mode]}
            </Text>
            {canStart ? (
              <>
                <Text style={styles.muted}>Enough people are here. Start now, or wait for more (up to {MAX_SEATS.group}).</Text>
                <View style={styles.startButton}>
                  <Button title="Start now" onPress={start} loading={startingNow} />
                </View>
                {startError && <Text style={styles.error}>{startError}</Text>}
              </>
            ) : (
              <>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.muted}>
                  {duo
                    ? "Your table opens as soon as someone who sees it differently sits down."
                    : `Waiting for ${needed} more ${needed === 1 ? "person" : "people"}. You can start at ${MIN_SEATS.group}.`}
                </Text>
              </>
            )}
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
            seats={MAX_SEATS[mode]}
            sideA={room.topic?.sideA}
            sideB={room.topic?.sideB}
          />
          <Text style={styles.muted}>{live ? "Everyone's here." : "Stay on this screen. We'll take you in when it opens."}</Text>
        </View>
      </Animated.View>

      <LeaveConfirmModal
        visible={confirmLeave}
        title="Leave the lobby?"
        body="You haven't started yet, so you won't lose any points."
        stayLabel="Stay"
        leaveLabel="Leave lobby"
        leaving={leaving}
        error={leaveError}
        onStay={closeLeave}
        onLeave={leaveLobby}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: "center", justifyContent: "center" },
  top: { paddingHorizontal: spacing.screen, paddingTop: spacing.sm, zIndex: 10, elevation: 10 },
  body: { flex: 1, padding: spacing.screen, gap: spacing.xl, justifyContent: "center" },
  countdownWrap: { alignItems: "center", gap: spacing.sm },
  countdown: { fontSize: 64, fontFamily: fonts.bold, color: colors.text, fontVariant: ["tabular-nums"] },
  startingWrap: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.lg },
  startingText: { fontSize: 28, fontFamily: fonts.bold, color: colors.accent, textAlign: "center" },
  membersCard: { gap: spacing.md, overflow: "hidden" },
  startButton: { alignSelf: "stretch" },
  error: { fontSize: 14, fontFamily: fonts.regular, color: colors.error, textAlign: "center" },
  muted: { fontSize: 15, fontFamily: fonts.regular, color: colors.muted, textAlign: "center" },
});

export { RoomErrorBoundary as ErrorBoundary } from "../../src/components/RoomErrorBoundary";
