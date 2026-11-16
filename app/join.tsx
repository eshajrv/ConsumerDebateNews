import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BackButton } from "../src/components/BackButton";
import { Button } from "../src/components/Button";
import { useJoinWithCode } from "../src/join";
import { colors, fonts, radius, spacing, type } from "../src/theme";

export default function Join() {
  const [code, setCode] = useState("");
  const { join, joining, error } = useJoinWithCode();
  const ready = code.length === 6;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.top}>
          <BackButton />
        </View>
        <View style={styles.body}>
          <Text style={type.question}>What&apos;s the password?</Text>
          <Text style={styles.hint}>Six digits, in the text or link we sent you.</Text>
          <TextInput
            value={code.length > 3 ? `${code.slice(0, 3)} ${code.slice(3)}` : code}
            onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
            placeholder="000 000"
            placeholderTextColor={colors.border}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={7}
            autoFocus
            onSubmitEditing={() => ready && join(code)}
            style={styles.input}
          />
        </View>
        <View style={styles.footer}>
          {error && <Text style={styles.error}>{error}</Text>}
          <Button title="Pull up a chair" disabled={!ready} loading={joining} onPress={() => join(code)} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  top: { paddingHorizontal: spacing.screen, paddingTop: spacing.sm },
  body: { flex: 1, paddingHorizontal: spacing.screen, paddingTop: spacing.xl, gap: spacing.lg },
  hint: { fontSize: 15, fontFamily: fonts.regular, lineHeight: 21, color: colors.muted },
  input: {
    fontSize: 40,
    fontFamily: fonts.bold,
    letterSpacing: 12,
    textAlign: "center",
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    paddingVertical: spacing.lg,
    fontVariant: ["tabular-nums"],
  },
  footer: { padding: spacing.screen, gap: spacing.md },
  error: { fontSize: 15, fontFamily: fonts.regular, color: colors.error, textAlign: "center" },
});
