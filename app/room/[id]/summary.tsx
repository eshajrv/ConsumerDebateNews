import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, Text } from "react-native";

import { colors, spacing, type } from "../../../src/theme";

export default function SummaryPlaceholder() {
  return (
    <SafeAreaView style={styles.safe}>
      <Text style={type.question}>Here&apos;s what I heard</Text>
      <Text style={styles.muted}>The chat is over. This screen is coming next.</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, gap: spacing.md, justifyContent: "center" },
  muted: { fontSize: 16, color: colors.muted },
});
