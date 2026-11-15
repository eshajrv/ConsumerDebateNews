import { router } from "expo-router";
import { Pressable, Text } from "react-native";

import { colors } from "../theme";

export function BackButton() {
  return (
    <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/home"))} hitSlop={12}>
      <Text style={{ fontSize: 16, fontWeight: "600", color: colors.accent }}>Back</Text>
    </Pressable>
  );
}
