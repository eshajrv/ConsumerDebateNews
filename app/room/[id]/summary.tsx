import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../../../src/components/Button";
import { MiniScale } from "../../../src/components/MiniScale";
import { useRoom, useRoomSummaries, useSubmitSummary } from "../../../src/data";
import { errorMessage } from "../../../src/errors";
import { useSavedUserId } from "../../../src/session";
import { card, colors, radius, spacing, type } from "../../../src/theme";

const MAX = 300;

export default function HeresWhatIHeard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useSavedUserId();
  const room = useRoom(id);
  const data = useRoomSummaries(id, userId);
  const summaries = data?.summaries;
  const submit = useSubmitSummary();
  const [text, setText] = useState("You ");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitted = !!summaries?.some((s) => s.authorId === userId);
  const aboutMe = summaries?.find((s) => s.aboutMe);
  const chatStillOn = room?.status === "waiting" || room?.status === "live" || room?.status === "rolled";
  const next = chatStillOn
    ? `/room/${id}`
    : submitted && aboutMe?.ready
      ? aboutMe.gotMeRating !== null
        ? `/room/${id}/results`
        : `/room/${id}/guess`
      : null;

  useEffect(() => {
    if (next) router.replace(next as `/room/${string}`);
  }, [next]);

  if (!room || !summaries || !userId || next) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        {room === null || data === null ? <Text style={type.body}>Room not found.</Text> : <ActivityIndicator color={colors.accent} />}
      </SafeAreaView>
    );
  }

  const me = room.members.find((m) => m.userId === userId);
  const target = room.members.find((m) => m.userId === me?.summarizesUserId);

  if (!target) {
    return (
      <SafeAreaView style={[styles.safe, styles.padded]}>
        <View style={styles.flexCenter}>
          <Text style={type.question}>Here&apos;s what I heard</Text>
          <Text style={styles.muted}>You weren&apos;t in this room&apos;s circle, so there&apos;s no one for you to summarize.</Text>
        </View>
        <Button title="Back to today's topics" onPress={() => router.replace("/home")} />
      </SafeAreaView>
    );
  }

  if (submitted) {
    return (
      <SafeAreaView style={[styles.safe, styles.center, styles.padded]}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={type.title}>Waiting for the others...</Text>
        <Text style={styles.muted}>Your summary of {target.name} is in. We&apos;ll show you what they heard from you next.</Text>
      </SafeAreaView>
    );
  }

  const valid = /^you\s+\S/i.test(text.trim());

  async function send() {
    if (!valid || !userId) return;
    setSending(true);
    setError(null);
    try {
      await submit({ roomId: id, authorId: userId, text: text.trim() });
    } catch (e) {
      setError(errorMessage(e, "That didn't send. Try again."));
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={type.label}>Here&apos;s what I heard</Text>
          <Text style={type.question}>You&apos;re summarizing {target.name}.</Text>

          <View style={[card, styles.scaleCard]}>
            <MiniScale members={[target]} youId={userId} />
          </View>

          <Text style={type.title}>In one sentence, what do they believe and why? Start with &quot;You...&quot;</Text>

          <View>
            <TextInput
              value={text}
              onChangeText={setText}
              maxLength={MAX}
              multiline
              autoFocus
              style={styles.input}
              placeholder="You think..."
              placeholderTextColor={colors.muted}
            />
            <Text style={styles.count}>{MAX - text.length}</Text>
          </View>
          {error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>
        <View style={styles.footer}>
          <Button title="Send" onPress={send} disabled={!valid} loading={sending} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center", gap: spacing.md },
  padded: { padding: spacing.screen },
  flexCenter: { flex: 1, justifyContent: "center", gap: spacing.md },
  content: { padding: spacing.screen, gap: spacing.lg },
  scaleCard: { paddingHorizontal: 0, paddingVertical: spacing.sm },
  input: {
    ...type.body,
    minHeight: 120,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.md,
    paddingBottom: spacing.xl,
    textAlignVertical: "top",
  },
  count: { position: "absolute", right: spacing.md, bottom: spacing.sm, fontSize: 12, color: colors.muted },
  muted: { fontSize: 16, lineHeight: 22, color: colors.muted, textAlign: "center" },
  error: { fontSize: 14, color: colors.error },
  footer: { padding: spacing.screen, paddingTop: spacing.sm },
});

export { RoomErrorBoundary as ErrorBoundary } from "../../../src/components/RoomErrorBoundary";
