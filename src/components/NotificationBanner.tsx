import { useEffect, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type Id, useMarkRead, useNotifications } from "../data";
import { openLink } from "../links";
import { useSavedUserId } from "../session";
import { colors, radius, spacing } from "../theme";

const SHOW_MS = 6000;

// When the app opens, slides down the newest unread notification once.
export function NotificationBanner() {
  const userId = useSavedUserId();
  const notifications = useNotifications(userId)?.notifications;
  const markRead = useMarkRead();
  const insets = useSafeAreaInsets();
  const [bannerId, setBannerId] = useState<Id | null | undefined>(undefined);
  const [slide] = useState(() => new Animated.Value(0));

  if (bannerId === undefined && notifications) {
    setBannerId(notifications.find((n) => !n.read)?._id ?? null);
  }
  const banner = notifications?.find((n) => n._id === bannerId && !n.read);

  useEffect(() => {
    if (!banner) return;
    Animated.spring(slide, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
    const t = setTimeout(() => setBannerId(null), SHOW_MS);
    return () => clearTimeout(t);
  }, [banner, slide]);

  if (!banner) return null;

  async function open() {
    if (!banner) return;
    setBannerId(null);
    await markRead({ notificationId: banner._id });
    if (banner.link) openLink(banner.link);
  }

  return (
    <Animated.View
      style={[
        styles.wrap,
        { top: insets.top + spacing.sm },
        { opacity: slide, transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-80, 0] }) }] },
      ]}
    >
      <Pressable onPress={open} style={styles.banner} accessibilityRole="button">
        <View style={styles.dot} />
        <Text style={styles.text} numberOfLines={2}>
          {banner.message}
        </Text>
        <Pressable onPress={() => setBannerId(null)} hitSlop={12} accessibilityLabel="Dismiss">
          <Text style={styles.close}>×</Text>
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: spacing.md, right: spacing.md },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 4,
    backgroundColor: colors.background,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    shadowColor: colors.text,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  text: { flex: 1, fontSize: 16, fontWeight: "600", color: colors.text },
  close: { fontSize: 22, lineHeight: 22, color: colors.muted },
});
