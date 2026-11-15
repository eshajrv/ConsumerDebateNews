import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { type RoomMessage, useRoom, useRoomMessages, useSendMessage } from "../../../src/data";
import { formatCountdown, useNow } from "../../../src/date";
import { useSavedUserId } from "../../../src/session";
import { colors, positionColor, radius, spacing, type } from "../../../src/theme";

const MAX = 500;

export default function GroupChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useSavedUserId();
  const room = useRoom(id);
  const messages = useRoomMessages(id);
  const send = useSendMessage();
  const now = useNow();
  const list = useRef<FlatList<RoomMessage>>(null);
  const [text, setText] = useState("");

  const status = room?.status;
  useEffect(() => {
    if (status === "summarizing" || status === "done") router.replace(`/room/${id}/summary`);
  }, [status, id]);

  if (!room || !messages) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        {room === null ? <Text style={type.body}>Room not found.</Text> : <ActivityIndicator color={colors.accent} />}
      </SafeAreaView>
    );
  }

  const remaining = (room.endsAt ?? now) - now;
  const opener = messages.find((m) => m.kind === "opener");
  const shown = messages.filter((m) => m !== opener);
  const memberById = new Map(room.members.map((m) => [m.userId, m]));

  async function submit() {
    const clean = text.trim();
    if (!clean || !userId) return;
    setText("");
    await send({ roomId: id, userId, text: clean });
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
          <Text style={[styles.timer, remaining <= 120_000 && { color: colors.sideA }]}>{formatCountdown(remaining)}</Text>
        </View>

        {opener && (
          <View style={styles.pinned}>
            <Text style={styles.judgeName}>Judge</Text>
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
                  <Text style={styles.judgeName}>Judge</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  dots: { flexDirection: "row", gap: 6 },
  headerDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.background },
  youRing: { borderColor: colors.accent, borderWidth: 2 },
  timer: { fontSize: 20, fontWeight: "800", color: colors.text, fontVariant: ["tabular-nums"] },
  pinned: { marginHorizontal: spacing.lg, padding: spacing.md, borderRadius: radius.card, backgroundColor: colors.surface, gap: spacing.xs },
  pinnedText: { fontSize: 16, lineHeight: 22, color: colors.text, fontWeight: "600" },
  warning: { textAlign: "center", fontSize: 14, fontWeight: "600", color: colors.sideA, paddingTop: spacing.sm },
  messages: { padding: spacing.lg, gap: spacing.md },
  judge: { alignSelf: "center", maxWidth: "85%", alignItems: "center", gap: 2, paddingVertical: spacing.xs },
  judgeName: { fontSize: 12, fontWeight: "700", color: colors.muted, letterSpacing: 0.5, textTransform: "uppercase" },
  judgeText: { fontSize: 15, lineHeight: 21, color: colors.muted, textAlign: "center", fontStyle: "italic" },
  row: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
  rowMine: { justifyContent: "flex-end" },
  dot: { width: 12, height: 12, borderRadius: 6, marginBottom: 6 },
  bubble: { maxWidth: "78%", borderRadius: radius.card, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md, gap: 2 },
  bubbleOther: { backgroundColor: colors.surface, borderBottomLeftRadius: 4 },
  bubbleMine: { backgroundColor: colors.accent, borderBottomRightRadius: 4 },
  flagged: { borderWidth: 1, borderColor: colors.sideA },
  sender: { fontSize: 12, fontWeight: "700", color: colors.muted },
  msgText: { fontSize: 16, lineHeight: 22, color: colors.text },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  inputWrap: { flex: 1 },
  input: { fontSize: 16, color: colors.text, backgroundColor: colors.surface, borderRadius: radius.card, paddingHorizontal: spacing.md, paddingTop: 12, paddingBottom: 12, maxHeight: 120 },
  count: { position: "absolute", right: 10, bottom: 4, fontSize: 11, color: colors.muted },
  send: { backgroundColor: colors.accent, borderRadius: radius.card, paddingHorizontal: spacing.md + 2, height: 46, justifyContent: "center" },
  sendOff: { opacity: 0.4 },
  sendText: { color: colors.onAccent, fontSize: 16, fontWeight: "700" },
});
