import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../../../src/components/Button";
import { StanceSlider } from "../../../src/components/StanceSlider";
import { useRoom, useSetPositionAfter } from "../../../src/data";
import { errorMessage } from "../../../src/errors";
import { useSavedUserId } from "../../../src/session";
import { colors, fonts, spacing, type } from "../../../src/theme";

// "Did minds move": one question after the chat ends, before "Here's what I heard".
export default function WhereDoYouStandNow() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useSavedUserId();
  const room = useRoom(id);
  const setPositionAfter = useSetPositionAfter();
  const [position, setPosition] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goOn = () => router.replace(`/room/${id}/summary`);
  const me = room?.members.find((m) => m.userId === userId);
  const cantAnswer = !!room && !!userId && (!me || !room.topic);
  useEffect(() => {
    if (cantAnswer) router.replace(`/room/${id}/summary`);
  }, [cantAnswer, id]);

  if (!room || !userId || !me || !room.topic) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        {room === null ? <Text style={type.body}>Table not found.</Text> : <ActivityIndicator color={colors.accent} />}
      </SafeAreaView>
    );
  }

  const topic = room.topic;
  const value = position ?? me.position;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await setPositionAfter({ roomId: id, userId: userId!, position: value });
      goOn();
    } catch (e) {
      setError(errorMessage(e, "That didn't save. Try again."));
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <Text style={type.label}>Before you go on</Text>
        <Text style={type.question}>Where do you stand now?</Text>
        <Text style={styles.muted}>{topic.question}</Text>
        <StanceSlider value={value} sideA={topic.sideA} sideB={topic.sideB} onChange={setPosition} onRelease={setPosition} />
        <Text style={styles.muted}>You started at {me.position}. It&apos;s fine if nothing changed.</Text>
      </View>
      <View style={styles.footer}>
        {error && <Text style={styles.error}>{error}</Text>}
        <Button title="Save and continue" loading={saving} onPress={save} />
        <Pressable onPress={goOn} hitSlop={12} style={styles.skip}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: "center", justifyContent: "center" },
  body: { flex: 1, padding: spacing.screen, paddingTop: spacing.xl, gap: spacing.lg },
  muted: { fontSize: 16, fontFamily: fonts.regular, lineHeight: 22, color: colors.muted },
  footer: { padding: spacing.screen, gap: spacing.md },
  error: { fontSize: 14, fontFamily: fonts.regular, color: colors.error, textAlign: "center" },
  skip: { alignSelf: "center" },
  skipText: { fontSize: 16, fontFamily: fonts.semibold, color: colors.accent },
});

export { RoomErrorBoundary as ErrorBoundary } from "../../../src/components/RoomErrorBoundary";
