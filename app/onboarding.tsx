import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../src/components/Button";
import { Chip } from "../src/components/Chip";
import { type Interest, type NotifyVia, useOnboard } from "../src/data";
import { saveUserId } from "../src/session";
import { colors, radius, spacing, type } from "../src/theme";

const INTERESTS: { value: Interest; label: string }[] = [
  { value: "tech", label: "Tech" },
  { value: "politics", label: "Politics" },
  { value: "culture", label: "Culture" },
  { value: "sports", label: "Sports" },
  { value: "campus", label: "Campus" },
];

const REACH: { value: NotifyVia; label: string; hint: string }[] = [
  { value: "app", label: "In the app", hint: "Nudges land in your Practify inbox." },
  { value: "text", label: "By text", hint: "Our agent texts you the feed and room links." },
];

export default function Onboarding() {
  const onboard = useOnboard();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [interests, setInterests] = useState<Interest[]>([]);
  const [notifyVia, setNotifyVia] = useState<NotifyVia | null>(null);
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phoneDigits = phone.replace(/\D/g, "");
  const canContinue = [
    name.trim().length > 0,
    interests.length >= 3,
    notifyVia === "app" || (notifyVia === "text" && phoneDigits.length >= 10),
  ][step];

  const toggleInterest = (value: Interest) =>
    setInterests((list) => (list.includes(value) ? list.filter((i) => i !== value) : [...list, value]));

  async function finish() {
    if (!notifyVia) return;
    setSaving(true);
    setError(null);
    try {
      const userId = await onboard({
        name: name.trim(),
        interests,
        notifyVia,
        phone: notifyVia === "text" ? phone.trim() : undefined,
      });
      await saveUserId(userId);
      router.replace("/home");
    } catch {
      setError("Couldn't save that. Check your connection and try again.");
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.top}>
          {step > 0 ? (
            <Pressable onPress={() => setStep(step - 1)} hitSlop={12}>
              <Text style={styles.back}>Back</Text>
            </Pressable>
          ) : (
            <View />
          )}
          <Text style={type.label}>{step + 1} of 3</Text>
        </View>

        <View style={styles.body}>
          {step === 0 && (
            <>
              <Text style={type.question}>What&apos;s your first name?</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="First name"
                placeholderTextColor={colors.muted}
                autoFocus
                autoCapitalize="words"
                autoComplete="given-name"
                maxLength={30}
                returnKeyType="next"
                onSubmitEditing={() => canContinue && setStep(1)}
                style={styles.input}
              />
            </>
          )}

          {step === 1 && (
            <>
              <Text style={type.question}>What do you want to talk about?</Text>
              <Text style={styles.hint}>Pick 3 or more. We use these to choose topics, never sides.</Text>
              <View style={styles.chips}>
                {INTERESTS.map((i) => (
                  <Chip key={i.value} label={i.label} selected={interests.includes(i.value)} onPress={() => toggleInterest(i.value)} />
                ))}
              </View>
            </>
          )}

          {step === 2 && (
            <>
              <Text style={type.question}>How should we reach you?</Text>
              <View style={styles.options}>
                {REACH.map((r) => {
                  const selected = notifyVia === r.value;
                  return (
                    <Pressable
                      key={r.value}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() => setNotifyVia(r.value)}
                      style={[styles.option, selected && styles.optionSelected]}
                    >
                      <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{r.label}</Text>
                      <Text style={styles.hint}>{r.hint}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {notifyVia === "text" && (
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Phone number"
                  placeholderTextColor={colors.muted}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  autoFocus
                  style={styles.input}
                />
              )}
              {notifyVia === "text" && <Text style={styles.hint}>We never share your number with other people.</Text>}
            </>
          )}
        </View>

        <View style={styles.footer}>
          {error && <Text style={styles.error}>{error}</Text>}
          <Button
            title={step < 2 ? "Continue" : "Start practicing"}
            disabled={!canContinue}
            loading={saving}
            onPress={() => (step < 2 ? setStep(step + 1) : finish())}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.md, minHeight: 40 },
  back: { fontSize: 16, fontWeight: "600", color: colors.accent },
  body: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xl, gap: spacing.lg },
  hint: { fontSize: 15, lineHeight: 21, color: colors.muted },
  input: {
    fontSize: 20,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm + 4 },
  options: { gap: spacing.md },
  option: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.card, padding: spacing.lg, gap: spacing.xs },
  optionSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  optionLabel: { fontSize: 18, fontWeight: "700", color: colors.text },
  optionLabelSelected: { color: colors.accent },
  footer: { padding: spacing.lg, gap: spacing.md },
  error: { fontSize: 15, color: colors.error, textAlign: "center" },
});
