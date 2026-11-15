import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { getSavedUserId } from "../src/session";
import { colors } from "../src/theme";

export default function Index() {
  const [userId, setUserId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    getSavedUserId().then(setUserId);
  }, []);

  if (userId === undefined) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return <Redirect href={userId ? "/home" : "/onboarding"} />;
}
