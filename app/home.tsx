import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useFeed, useUser } from "../src/data";
import { todayString } from "../src/date";
import { clearUserId, getSavedUserId } from "../src/session";
import { card, colors, spacing, type } from "../src/theme";

export default function Home() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    getSavedUserId().then(setUserId);
  }, []);

  const user = useUser(userId);
  const topics = useFeed(userId, todayString());

  async function signOut() {
    await clearUserId();
    router.replace("/onboarding");
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={type.question}>{user ? `Good morning, ${user.name}` : "Good morning"}</Text>
        <Text style={styles.muted}>Home is a placeholder for now. Here&apos;s today&apos;s feed.</Text>
        {topics === undefined ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          topics.map((t) => (
            <View key={t._id} style={card}>
              <Text style={type.label}>{t.isShared ? "TOPIC OF THE DAY" : t.category.toUpperCase()}</Text>
              <Text style={[type.title, styles.question]}>{t.question}</Text>
            </View>
          ))
        )}
        <Pressable onPress={signOut} hitSlop={12} style={styles.signOut}>
          <Text style={styles.muted}>Start over</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  muted: { fontSize: 16, color: colors.muted },
  question: { marginTop: spacing.sm },
  signOut: { alignSelf: "center", paddingVertical: spacing.lg },
});
