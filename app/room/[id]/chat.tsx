import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../../../src/components/Button";
import { SeatTable } from "../../../src/components/SeatTable";
import { TypingBubble } from "../../../src/components/TypingBubble";
import { type RoomMessage, useLeaveRoom, useRoom, useRoomMessages, useSendMessage, useSetTyping, useVoteEnd } from "../../../src/data";
import { formatCountdown, useNow } from "../../../src/date";
import { errorMessage } from "../../../src/errors";
import { clearSavedRoomId, useSavedUserId } from "../../../src/session";
import { card, colors, fonts, radius, spacing, type } from "../../../src/theme";

const MAX = 500;
const TYPING_THROTTLE_MS = 2000;
const TYPING_MS = 4000; // how long rooms.setTyping keeps typingUntil ahead of the call

// Bubble tint and name color by where the sender stands
const BAND_TINT = {
  A: { bubble: colors.sideASoft, name: colors.sideA },
  M: { bubble: colors.middleSoft, name: colors.middleText },
  B: { bubble: colors.sideBSoft, name: colors.sideB },
} as const;

export default function GroupChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useSavedUserId();
  const room = useRoom(id);
  const messages = useRoomMessages(id);
  const send = useSendMessage();
  const leave = useLeaveRoom();
  const voteEnd = useVoteEnd();
  const setTyping = useSetTyping();
  const now = useNow();
  const list = useRef<FlatList<RoomMessage>>(null);
  const lastTypingAt = useRef(0);
  const [text, setText] = useState("");
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [wantsToEnd, setWantsToEnd] = useState(false);

  const status = room?.status;
  useEffect(() => {
    if (leaving) return;
    if (status === "summarizing" || status === "done") router.replace(`/room/${id}/stand`);
  }, [status, id, leaving]);

  if (!room || !messages) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        {room === null ? <Text style={type.body}>Table not found.</Text> : <ActivityIndicator color={colors.accent} />}
      </SafeAreaView>
    );
  }

  const remaining = (room.endsAt ?? now) - now;
  const opener = messages.find((m) => m.kind === "opener");
  const shown = messages.filter((m) => m !== opener);
  const memberById = new Map(room.members.map((m) => [m.userId, m]));
  const endVotes = Math.max(room.endVotes ?? 0, wantsToEnd ? 1 : 0);
  const seated = room.members.filter((m) => !m.leftAt);
  const me = memberById.get(userId ?? "");
  const listenFor = me?.summarizesUserId ? memberById.get(me.summarizesUserId) : undefined;
  const lastTwo = remaining > 0 && remaining <= 120_000;
  const activeCount = room.activeCount ?? room.members.length;
  const lastMessageAt = new Map(shown.filter((m) => m.userId).map((m) => [m.userId!, m._creationTime]));
  const typingNames = seated
    .filter((m) => m.userId !== userId && (m.typingUntil ?? 0) > now)
    .filter((m) => (lastMessageAt.get(m.userId) ?? 0) < m.typingUntil! - TYPING_MS)
    .map((m) => m.name.split(" ")[0]);

  function changeText(next: string) {
    setText(next);
    if (!next.trim() || !userId || room?.status !== "live") return;
    const at = Date.now();
    if (at - lastTypingAt.current < TYPING_THROTTLE_MS) return;
    lastTypingAt.current = at;
    setTyping({ roomId: id, userId }).catch(() => {});
  }

  async function submit() {
    const clean = text.trim();
    if (!clean || !userId) return;
    setText("");
    await send({ roomId: id, userId, text: clean });
  }

  async function setEndVote(next: boolean) {
    if (!userId) return;
    setWantsToEnd(next);
    try {
      await voteEnd({ roomId: id, userId, wantsToEnd: next });
    } catch {
      setWantsToEnd(!next);
    }
  }

  async function leaveRoom() {
    if (!userId || !room) return;
    setLeaving(true);
    setLeaveError(null);
    try {
      await leave({ roomId: id, userId });
      await clearSavedRoomId();
      router.replace({ pathname: "/home", params: { left: "1" } });
    } catch (e) {
      const message = errorMessage(e, "Couldn't leave the room. Try again.");
      if (room.status !== "live" || message.includes("while the chat is live")) {
        router.replace(`/room/${id}/results`);
        return;
      }
      setLeaving(false);
      setLeaveError(message);
    }
  }

  function closeLeave() {
    if (leaving) return;
    setConfirmLeave(false);
    setLeaveError(null);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <Pressable
            onPress={() => setConfirmLeave(true)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Leave the table"
            style={({ pressed }) => pressed && { opacity: 0.7 }}
          >
            <Text style={styles.back}>‹ Back</Text>
          </Pressable>
          <Text style={styles.atBar}>{`${room.watcherCount ?? 0} at the bar`}</Text>
          <View style={[styles.timerPill, lastTwo && styles.timerPillUrgent]}>
            <Text style={[styles.timer, lastTwo && styles.timerUrgent]}>{formatCountdown(remaining)}</Text>
          </View>
        </View>

        {room.topic && (
          <View style={styles.tableArea}>
            <Text style={styles.question} numberOfLines={2}>
              {room.topic.question}
            </Text>
            <SeatTable members={seated} youId={userId} sideA={room.topic.sideA} sideB={room.topic.sideB} height={120} />
          </View>
        )}

        {room.status === "live" && (
          <View style={styles.endRow}>
            {wantsToEnd ? (
              <>
                <Text style={styles.endWaiting}>{`Waiting for others · ${endVotes}/${activeCount}`}</Text>
                <Pressable onPress={() => setEndVote(false)} hitSlop={8} accessibilityRole="button">
                  {({ pressed }) => <Text style={[styles.undo, pressed && { opacity: 0.7 }]}>Undo</Text>}
                </Pressable>
              </>
            ) : (
              <Pressable
                onPress={() => setEndVote(true)}
                hitSlop={8}
                accessibilityRole="button"
                style={({ pressed }) => [styles.endPill, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.endPillText}>End debate</Text>
              </Pressable>
            )}
          </View>
        )}

        {opener && (
          <View style={[styles.hostNote, styles.pinned]}>
            <Text style={styles.judgeName}>The host</Text>
            <Text style={styles.hostText}>{opener.text}</Text>
          </View>
        )}

        {lastTwo && (
          <Text style={styles.warning}>2 minutes left. Start finding where you agree.</Text>
        )}

        <FlatList
          ref={list}
          data={shown}
          keyExtractor={(m) => m._id}
          contentContainerStyle={styles.messages}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
          ListFooterComponent={typingNames.length > 0 ? <TypingBubble names={typingNames} /> : undefined}
          renderItem={({ item }) => {
            if (item.kind !== "user") {
              return (
                <View style={styles.hostNote}>
                  <Text style={styles.judgeName}>The host</Text>
                  <Text style={styles.hostText}>{item.text}</Text>
                </View>
              );
            }
            const member = item.userId ? memberById.get(item.userId) : undefined;
            const mine = item.userId === userId;
            const tint = BAND_TINT[member?.band ?? "M"];
            return (
              <View style={[styles.row, mine && styles.rowMine]}>
                <View
                  style={[
                    styles.bubble,
                    { backgroundColor: tint.bubble },
                    mine ? styles.bubbleMine : styles.bubbleOther,
                    item.flagged && styles.flagged,
                  ]}
                >
                  <Text style={[styles.sender, { color: tint.name }]}>{mine ? "You" : (member?.name ?? "Someone").split(" ")[0]}</Text>
                  <Text style={styles.msgText}>{item.text}</Text>
                </View>
              </View>
            );
          }}
        />

        {listenFor && room.status === "live" && (
          <Text style={styles.listen}>
            Listen for <Text style={styles.listenName}>{listenFor.name.split(" ")[0]}</Text>: you&apos;ll sum up their view at the end
          </Text>
        )}

        <View style={styles.composer}>
          <View style={styles.inputWrap}>
            <TextInput
              value={text}
              onChangeText={changeText}
              placeholder="Say what you think, or ask a question"
              placeholderTextColor={colors.muted}
              maxLength={MAX}
              multiline
              style={styles.input}
            />
            {text.length > MAX - 100 && <Text style={styles.count}>{MAX - text.length}</Text>}
          </View>
          <Pressable
            onPress={submit}
            disabled={!text.trim() || room.status !== "live"}
            style={({ pressed }) => [styles.send, (!text.trim() || room.status !== "live") && styles.sendOff, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.sendText}>Send</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={confirmLeave} transparent animationType="fade" onRequestClose={closeLeave}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeLeave} />
          <View style={styles.modal}>
            <Text style={type.title}>Leave this room?</Text>
            <Text style={styles.modalBody}>
              {"If you leave now you'll lose 10 points and 5 good-faith points, and you won't get a summary or results for this room."}
            </Text>
            {leaveError && <Text style={styles.modalError}>{leaveError}</Text>}
            <View style={styles.modalActions}>
              <Button title="Stay and talk" onPress={closeLeave} disabled={leaving} />
              <Pressable
                onPress={leaveRoom}
                disabled={leaving}
                accessibilityRole="button"
                style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.7 }]}
              >
                {leaving ? <ActivityIndicator color={colors.muted} /> : <Text style={styles.secondaryText}>Leave room</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.screen, paddingVertical: spacing.sm },
  back: { fontSize: 16, fontFamily: fonts.semibold, color: colors.accent },
  atBar: { fontSize: 13, fontFamily: fonts.medium, color: colors.muted },
  timerPill: { backgroundColor: colors.accentSoft, borderRadius: radius.pill, paddingVertical: spacing.xs, paddingHorizontal: spacing.md - 4 },
  timerPillUrgent: { backgroundColor: colors.accent },
  timerUrgent: { color: colors.onAccent },
  tableArea: { paddingHorizontal: spacing.screen, gap: spacing.xs, paddingBottom: spacing.sm },
  question: { fontSize: 18, lineHeight: 24, fontFamily: fonts.display, color: colors.text },
  hostNote: {
    backgroundColor: colors.accentSoft,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md - 4,
    gap: 2,
  },
  hostText: { fontSize: 15, fontFamily: fonts.regular, lineHeight: 21, color: colors.text },
  listen: { fontSize: 13, fontFamily: fonts.regular, color: colors.muted, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  listenName: { fontFamily: fonts.semibold, color: colors.text },
  endRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: spacing.sm, paddingHorizontal: spacing.screen, paddingBottom: spacing.sm },
  endPill: { borderWidth: 1, borderColor: colors.text, borderRadius: radius.pill, paddingVertical: spacing.xs, paddingHorizontal: spacing.md - 4 },
  endPillText: { fontSize: 13, fontFamily: fonts.semibold, color: colors.text },
  endWaiting: { fontSize: 13, fontFamily: fonts.medium, color: colors.muted, fontVariant: ["tabular-nums"] },
  undo: { fontSize: 13, fontFamily: fonts.semibold, color: colors.accent, textDecorationLine: "underline" },
  timer: { fontSize: 16, fontFamily: fonts.bold, color: colors.accent, fontVariant: ["tabular-nums"] },
  pinned: { marginHorizontal: spacing.screen },
  warning: { textAlign: "center", fontSize: 14, fontFamily: fonts.semibold, color: colors.sideA, paddingTop: spacing.sm },
  messages: { padding: spacing.screen, gap: spacing.md },
  judgeName: { fontSize: 11, fontFamily: fonts.bold, color: colors.accent, letterSpacing: 1.2, textTransform: "uppercase" },
  row: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
  rowMine: { justifyContent: "flex-end" },
  bubble: { maxWidth: "78%", borderRadius: radius.card, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md, gap: 2 },
  bubbleOther: { borderBottomLeftRadius: 4 },
  bubbleMine: { borderBottomRightRadius: 4 },
  flagged: { borderWidth: 1, borderColor: colors.sideA },
  sender: { fontSize: 12, fontFamily: fonts.bold },
  msgText: { fontSize: 16, fontFamily: fonts.regular, lineHeight: 22, color: colors.text },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  inputWrap: { flex: 1 },
  input: { fontSize: 16, fontFamily: fonts.regular, color: colors.text, backgroundColor: colors.surface, borderRadius: radius.card, paddingHorizontal: spacing.md, paddingTop: 12, paddingBottom: 12, maxHeight: 120 },
  count: { position: "absolute", right: 10, bottom: 4, fontSize: 11, fontFamily: fonts.regular, color: colors.muted },
  send: { backgroundColor: colors.accent, borderRadius: radius.card, paddingHorizontal: spacing.md + 2, height: 46, justifyContent: "center" },
  sendOff: { opacity: 0.4 },
  sendText: { color: colors.onAccent, fontSize: 16, fontFamily: fonts.bold },
  backdrop: { flex: 1, justifyContent: "center", padding: spacing.lg, backgroundColor: "rgba(29,42,36,0.45)" },
  modal: { ...card, gap: spacing.md },
  modalBody: { ...type.body, color: colors.muted },
  modalError: { fontSize: 14, fontFamily: fonts.medium, color: colors.error },
  modalActions: { gap: spacing.sm, marginTop: spacing.sm },
  secondary: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, minHeight: 56, alignItems: "center", justifyContent: "center" },
  secondaryText: { fontSize: 17, fontFamily: fonts.semibold, color: colors.muted },
});

export { RoomErrorBoundary as ErrorBoundary } from "../../../src/components/RoomErrorBoundary";
