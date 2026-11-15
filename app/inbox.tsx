import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BackButton } from "../src/components/BackButton";
import { type AppNotification, useMarkAllRead, useMarkRead, useNotifications } from "../src/data";
import { formatTime } from "../src/date";
import { openLink } from "../src/links";
import { useSavedUserId } from "../src/session";
import { colors, radius, spacing, type } from "../src/theme";

function when(ms: number) {
  const mins = Math.floor((Date.now() - ms) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 12 * 60) return `${Math.floor(mins / 60)}h ago`;
  return formatTime(ms);
}

export default function Inbox() {
  const userId = useSavedUserId();
  const inbox = useNotifications(userId);
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  async function open(n: AppNotification) {
    if (!n.read) await markRead({ notificationId: n._id });
    if (n.link) openLink(n.link);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <BackButton />
      </View>
      <View style={styles.header}>
        <Text style={type.question}>Inbox</Text>
        {userId && inbox && inbox.unreadCount > 0 && (
          <Pressable onPress={() => markAllRead({ userId })} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.markAll}>Mark all read</Text>
          </Pressable>
        )}
      </View>
      {inbox === undefined ? (
        <ActivityIndicator color={colors.accent} style={styles.loading} />
      ) : (
        <FlatList
          data={inbox.notifications}
          keyExtractor={(n) => n._id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>You&apos;re all caught up.</Text>}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => open(item)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.row, !item.read && styles.unread, pressed && styles.pressed]}
            >
              <View style={[styles.dot, item.read && styles.dotRead]} />
              <View style={styles.flex}>
                <Text style={[styles.message, !item.read && styles.messageUnread]}>{item.message}</Text>
                <Text style={styles.time}>{when(item._creationTime)}</Text>
              </View>
              {item.link && <Text style={styles.chevron}>›</Text>}
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  top: { paddingHorizontal: spacing.screen, paddingTop: spacing.sm },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  markAll: { fontSize: 15, fontWeight: "600", color: colors.accent },
  loading: { marginTop: spacing.xl },
  list: { padding: spacing.screen, gap: spacing.sm },
  empty: { fontSize: 16, color: colors.muted, textAlign: "center", marginTop: spacing.xl },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border },
  unread: { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft },
  pressed: { opacity: 0.8 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  dotRead: { backgroundColor: "transparent" },
  flex: { flex: 1, gap: 2 },
  message: { fontSize: 16, lineHeight: 22, color: colors.text },
  messageUnread: { fontWeight: "700" },
  time: { fontSize: 13, color: colors.muted },
  chevron: { fontSize: 24, color: colors.muted },
});
