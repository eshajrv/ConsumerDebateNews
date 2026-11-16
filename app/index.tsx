import { type Href, Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { useResumeRoom } from "../src/resume";
import { getSavedUserId } from "../src/session";
import { colors } from "../src/theme";

export default function Index() {
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const resume = useResumeRoom(userId);

  useEffect(() => {
    getSavedUserId().then(setUserId);
  }, []);

  if (userId === undefined || resume.checking) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!userId) return <Redirect href="/onboarding" />;
  return <Redirect href={(resume.target ?? "/home") as Href} />;
}
