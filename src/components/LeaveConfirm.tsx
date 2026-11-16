import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { card, colors, fonts, radius, spacing, type } from "../theme";
import { Button } from "./Button";

// The "‹ Back" link in a room's top bar that opens LeaveConfirmModal
export function LeaveButton({ label, accessibilityLabel, onPress }: { label: string; accessibilityLabel: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => pressed && { opacity: 0.7 }}
    >
      <Text style={styles.back}>{label}</Text>
    </Pressable>
  );
}

type ModalProps = {
  visible: boolean;
  title: string;
  body: string;
  stayLabel: string;
  leaveLabel: string;
  leaving: boolean;
  error: string | null;
  onStay: () => void;
  onLeave: () => void;
};

export function LeaveConfirmModal({ visible, title, body, stayLabel, leaveLabel, leaving, error, onStay, onLeave }: ModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onStay}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onStay} />
        <View style={styles.modal}>
          <Text style={type.title}>{title}</Text>
          <Text style={styles.modalBody}>{body}</Text>
          {error && <Text style={styles.modalError}>{error}</Text>}
          <View style={styles.modalActions}>
            <Button title={stayLabel} onPress={onStay} disabled={leaving} />
            <Pressable
              onPress={onLeave}
              disabled={leaving}
              accessibilityRole="button"
              style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.7 }]}
            >
              {leaving ? <ActivityIndicator color={colors.muted} /> : <Text style={styles.secondaryText}>{leaveLabel}</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  back: { fontSize: 16, fontFamily: fonts.semibold, color: colors.accent },
  backdrop: { flex: 1, justifyContent: "center", padding: spacing.lg, backgroundColor: "rgba(29,42,36,0.45)" },
  modal: { ...card, gap: spacing.md },
  modalBody: { ...type.body, color: colors.muted },
  modalError: { fontSize: 14, fontFamily: fonts.medium, color: colors.error },
  modalActions: { gap: spacing.sm, marginTop: spacing.sm },
  secondary: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, minHeight: 56, alignItems: "center", justifyContent: "center" },
  secondaryText: { fontSize: 17, fontFamily: fonts.semibold, color: colors.muted },
});
