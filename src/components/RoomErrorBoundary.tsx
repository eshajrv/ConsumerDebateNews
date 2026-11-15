import { type ErrorBoundaryProps, router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing, type } from "../theme";
import { Button } from "./Button";

// Shown instead of a red screen when a room query fails (for example a link to a room that doesn't exist).
export function RoomErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <Text style={type.title}>We couldn&apos;t open this room.</Text>
        <Text style={styles.muted} onPress={retry}>
          Tap to try again
        </Text>
      </View>
      <View style={styles.footer}>
        <Button title="Back to today's topics" onPress={() => router.replace("/home")} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.screen },
  muted: { fontSize: 16, color: colors.accent, fontWeight: "600" },
  footer: { padding: spacing.screen },
});
