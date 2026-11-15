import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../../src/components/Button";
import { useJoinWithCode } from "../../src/join";
import { colors, spacing, type } from "../../src/theme";

export default function JoinWithLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { join, error } = useJoinWithCode();

  useEffect(() => {
    join(code ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        {error ? (
          <Text style={[type.title, styles.center]}>{error}</Text>
        ) : (
          <>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.muted}>Joining your room...</Text>
          </>
        )}
      </View>
      {error && (
        <View style={styles.footer}>
          <Button title="Enter the code" onPress={() => router.replace("/join")} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.screen, gap: spacing.md },
  center: { textAlign: "center" },
  muted: { fontSize: 16, color: colors.muted, textAlign: "center" },
  footer: { padding: spacing.screen },
});
