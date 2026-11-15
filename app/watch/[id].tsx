import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Animated, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BackButton } from "../../src/components/BackButton";
import { Button } from "../../src/components/Button";
import { type RoomMessage, useRoom, useRoomMessages } from "../../src/data";
import { formatCountdown, useNow } from "../../src/date";
import { colors, positionColor, radius, spacing, type } from "../../src/theme";

const REACTIONS = ["Good point", "Interesting", "Made me think"] as const;

// Spectator reactions are local only until the backend has somewhere to store them.
function ReactionButton({ label }: { label: string }) {
  const [count, setCount] = useState(0);
  const [pop] = useState(() => new Animated.Value(0));
  const [float] = useState(() => new Animated.Value(1));

  function react() {
    setCount((c) => c + 1);
    pop.setValue(0);
    float.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(pop, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.spring(pop, { toValue: 0, friction: 4, useNativeDriver: true }),
      ]),
      Animated.timing(float, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]).start();
  }

  return (
    <Pressable onPress={react} accessibilityRole="button" accessibilityLabel={label} style={styles.reactionWrap}>
      <Animated.Text
        pointerEvents="none"
        style={[
          styles.plusOne,
          {
            opacity: float.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
            transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -28] }) }],
          },
        ]}
      >
        +1
      </Animated.Text>
      <Animated.View
        style={[
          styles.reaction,
          count > 0 && styles.reactionOn,
          { transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }) }] },
        ]}
      >
        <Text style={[styles.reactionText, count > 0 && styles.reactionTextOn]} numberOfLines={2}>
          {label}
          {count > 0 ? ` ${count}` : ""}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function Ended({ text }: { text: string }) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={[styles.flex, styles.center]}>
        <Text style={type.title}>{text}</Text>
      </View>
      <View style={styles.footer}>
        <Button title="See other live rooms" onPress={() => router.replace("/watch")} />
      </View>
    </SafeAreaView>
  );
}

export default function WatchRoom() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const room = useRoom(id);
  const messages = useRoomMessages(id);
  const now = useNow();
  const list = useRef<FlatList<RoomMessage>>(null);

  if (room === null) return <Ended text="Room not found." />;
  if (!room || !messages) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }
  if (room.allowSpectators === false) return <Ended text="This room is private." />;
  if (room.status !== "live") return <Ended text={room.status === "waiting" || room.status === "rolled" ? "This room hasn't started yet." : "This room has ended."} />;

  const remaining = (room.endsAt ?? now) - now;
  const opener = messages.find((m) => m.kind === "opener");
  const shown = messages.filter((m) => m !== opener);
  const memberById = new Map(room.members.map((m) => [m.userId, m]));

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <BackButton />
        <View style={styles.watching}>
          <View style={styles.liveDot} />
          <Text style={styles.watchingText}>Watching</Text>
        </View>
        <Text style={[styles.timer, remaining <= 120_000 && { color: colors.sideA }]}>{formatCountdown(remaining)}</Text>
      </View>

      {room.topic && <Text style={styles.question}>{room.topic.question}</Text>}

      {opener && (
        <View style={styles.pinned}>
          <Text style={styles.judgeName}>Judge</Text>
          <Text style={styles.pinnedText}>{opener.text}</Text>
        </View>
      )}

      <FlatList
        ref={list}
        data={shown}
        keyExtractor={(m) => m._id}
        contentContainerStyle={styles.messages}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={<Text style={styles.empty}>No one has spoken yet.</Text>}
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
          return (
            <View style={styles.row}>
              <View style={[styles.dot, { backgroundColor: positionColor(member?.position ?? 50) }]} />
              <View style={[styles.bubble, item.flagged && styles.flagged]}>
                <Text style={styles.sender}>{member?.name ?? "Someone"}</Text>
                <Text style={styles.msgText}>{item.text}</Text>
              </View>
            </View>
          );
        }}
      />

      <View style={styles.reactions}>
        {REACTIONS.map((label) => (
          <ReactionButton key={label} label={label} />
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center", padding: spacing.screen },
  footer: { padding: spacing.screen },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.screen, paddingVertical: spacing.sm },
  watching: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.sideA },
  watchingText: { fontSize: 14, fontWeight: "700", color: colors.sideA },
  timer: { fontSize: 20, fontWeight: "800", color: colors.text, fontVariant: ["tabular-nums"] },
  question: { fontSize: 18, lineHeight: 24, fontWeight: "700", color: colors.text, paddingHorizontal: spacing.screen, paddingBottom: spacing.sm },
  pinned: { marginHorizontal: spacing.screen, padding: spacing.md, borderRadius: radius.card, backgroundColor: colors.surface, gap: spacing.xs },
  pinnedText: { fontSize: 16, lineHeight: 22, color: colors.text, fontWeight: "600" },
  messages: { padding: spacing.screen, gap: spacing.md },
  empty: { fontSize: 15, color: colors.muted, textAlign: "center" },
  judge: { alignSelf: "center", maxWidth: "85%", alignItems: "center", gap: 2, paddingVertical: spacing.xs },
  judgeName: { fontSize: 12, fontWeight: "700", color: colors.muted, letterSpacing: 0.5, textTransform: "uppercase" },
  judgeText: { fontSize: 15, lineHeight: 21, color: colors.muted, textAlign: "center", fontStyle: "italic" },
  row: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
  dot: { width: 12, height: 12, borderRadius: 6, marginBottom: 6 },
  bubble: { maxWidth: "82%", borderRadius: radius.card, borderBottomLeftRadius: 4, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md, gap: 2, backgroundColor: colors.surface },
  flagged: { borderWidth: 1, borderColor: colors.sideA },
  sender: { fontSize: 12, fontWeight: "700", color: colors.muted },
  msgText: { fontSize: 16, lineHeight: 22, color: colors.text },
  reactions: { flexDirection: "row", gap: spacing.sm, padding: spacing.screen, borderTopWidth: 1, borderTopColor: colors.border },
  reactionWrap: { flex: 1, alignItems: "center" },
  reaction: { alignSelf: "stretch", alignItems: "center", justifyContent: "center", minHeight: 44, paddingHorizontal: spacing.xs, paddingVertical: spacing.xs, borderRadius: radius.card, borderWidth: 1.5, borderColor: colors.border },
  reactionOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  reactionText: { fontSize: 13, lineHeight: 16, fontWeight: "700", color: colors.text, textAlign: "center" },
  reactionTextOn: { color: colors.accent },
  plusOne: { position: "absolute", top: -6, fontSize: 14, fontWeight: "800", color: colors.accent },
});
