import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../../../src/components/Button";
import { type RoomMessage, useLeaveRoom, useRoom, useRoomMessages, useSendMessage, useVoteEnd } from "../../../src/data";
import { formatCountdown, useNow } from "../../../src/date";
import { errorMessage } from "../../../src/errors";
import { useSavedUserId } from "../../../src/session";
import { card, colors, fonts, positionColor, radius, spacing, type } from "../../../src/theme";

const MAX = 500;

export default function GroupChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useSavedUserId();
  const room = useRoom(id);
  const messages = useRoomMessages(id);
  const send = useSendMessage();
  const leave = useLeaveRoom();
  const voteEnd = useVoteEnd();
  const now = useNow();
  const list = useRef<FlatList<RoomMessage>>(null);
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
  const activeCount = room.activeCount ?? room.members.length;

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
          <View style={styles.dots}>
            {room.members.map((m) => (
              <View key={m.userId} style={[styles.headerDot, { backgroundColor: positionColor(m.position) }, m.userId === userId && styles.youRing]} />
            ))}
          </View>
          <View style={styles.headerRight}>
            <Text style={[styles.timer, remaining <= 120_000 && { color: colors.sideA }]}>{formatCountdown(remaining)}</Text>
            <Pressable
              onPress={() => setConfirmLeave(true)}
              hitSlop={8}
              accessibilityRole="button"
              style={({ pressed }) => [styles.leave, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.leaveText}>Leave</Text>
            </Pressable>
          </View>
        </View>

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
          <View style={styles.pinned}>
            <Text style={styles.judgeName}>The host</Text>
            <Text style={styles.pinnedText}>{opener.text}</Text>
          </View>
        )}

        {remaining > 0 && remaining <= 120_000 && (
          <Text style={styles.warning}>2 minutes left. Start finding where you agree.</Text>
        )}

        <FlatList
          ref={list}
          data={shown}
          keyExtractor={(m) => m._id}
          contentContainerStyle={styles.messages}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => {
            if (item.kind !== "user") {
              return (
                <View style={styles.judge}>
                  <Text style={styles.judgeName}>The host</Text>
                  <Text style={styles.judgeText}>{item.text}</Text>
                </View>
              );
            }
            const member = item.userId ? memberById.get(item.userId) : undefined;
            const mine = item.userId === userId;
            return (
              <View style={[styles.row, mine && styles.rowMine]}>
                {!mine && <View style={[styles.dot, { backgroundColor: positionColor(member?.position ?? 50) }]} />}
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther, item.flagged && styles.flagged]}>
                  {!mine && <Text style={styles.sender}>{member?.name ?? "Someone"}</Text>}
                  <Text style={[styles.msgText, mine && { color: colors.onAccent }]}>{item.text}</Text>
                </View>
                {mine && <View style={[styles.dot, styles.youRing, { backgroundColor: positionColor(member?.position ?? 50) }]} />}
              </View>
            );
          }}
        />

        <View style={styles.composer}>
          <View style={styles.inputWrap}>
            <TextInput
              value={text}
              onChangeText={setText}
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
  dots: { flexDirection: "row", gap: 6 },
  headerDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.background },
  youRing: { borderColor: colors.accent, borderWidth: 2 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  leave: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingVertical: spacing.xs, paddingHorizontal: spacing.md - 4 },
  leaveText: { fontSize: 13, fontFamily: fonts.semibold, color: colors.muted },
  endRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: spacing.sm, paddingHorizontal: spacing.screen, paddingBottom: spacing.sm },
  endPill: { borderWidth: 1, borderColor: colors.text, borderRadius: radius.pill, paddingVertical: spacing.xs, paddingHorizontal: spacing.md - 4 },
  endPillText: { fontSize: 13, fontFamily: fonts.semibold, color: colors.text },
  endWaiting: { fontSize: 13, fontFamily: fonts.medium, color: colors.muted, fontVariant: ["tabular-nums"] },
  undo: { fontSize: 13, fontFamily: fonts.semibold, color: colors.accent, textDecorationLine: "underline" },
  timer: { fontSize: 20, fontFamily: fonts.bold, color: colors.text, fontVariant: ["tabular-nums"] },
  pinned: { marginHorizontal: spacing.screen, padding: spacing.md, borderRadius: radius.card, backgroundColor: colors.surface, gap: spacing.xs },
  pinnedText: { fontSize: 16, fontFamily: fonts.semibold, lineHeight: 22, color: colors.text },
  warning: { textAlign: "center", fontSize: 14, fontFamily: fonts.semibold, color: colors.sideA, paddingTop: spacing.sm },
  messages: { padding: spacing.screen, gap: spacing.md },
  judge: { alignSelf: "center", maxWidth: "85%", alignItems: "center", gap: 2, paddingVertical: spacing.xs },
  judgeName: { fontSize: 12, fontFamily: fonts.bold, color: colors.muted, letterSpacing: 0.5, textTransform: "uppercase" },
  judgeText: { fontSize: 15, fontFamily: fonts.regular, lineHeight: 21, color: colors.muted, textAlign: "center", fontStyle: "italic" },
  row: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
  rowMine: { justifyContent: "flex-end" },
  dot: { width: 12, height: 12, borderRadius: 6, marginBottom: 6 },
  bubble: { maxWidth: "78%", borderRadius: radius.card, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md, gap: 2 },
  bubbleOther: { backgroundColor: colors.surface, borderBottomLeftRadius: 4 },
  bubbleMine: { backgroundColor: colors.accent, borderBottomRightRadius: 4 },
  flagged: { borderWidth: 1, borderColor: colors.sideA },
  sender: { fontSize: 12, fontFamily: fonts.bold, color: colors.muted },
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
