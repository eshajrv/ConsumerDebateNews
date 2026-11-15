import { useQuery } from "convex/react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";

import { api } from "../convex/_generated/api";

export default function Index() {
  const topics = useQuery(api.topics.today);

  if (topics === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (topics.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>No topics today. Run `npx convex run topics:seed`.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={topics}
      keyExtractor={(topic) => topic._id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.category}>{item.category.toUpperCase()}</Text>
          <Text style={styles.question}>{item.question}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  empty: { color: "#666", textAlign: "center" },
  list: { padding: 16, gap: 12 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#e5e5e5" },
  category: { fontSize: 12, fontWeight: "600", color: "#888", marginBottom: 6 },
  question: { fontSize: 17, fontWeight: "600", color: "#111" },
});
