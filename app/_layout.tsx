// Import single weights so the bundle only ships the 6 font files we use
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import { PlayfairDisplay_500Medium } from "@expo-google-fonts/playfair-display/500Medium";
import { PlayfairDisplay_600SemiBold } from "@expo-google-fonts/playfair-display/600SemiBold";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { useFonts } from "expo-font";
import { router, Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { type ReactNode, useEffect } from "react";

import { NotificationBanner } from "../src/components/NotificationBanner";
import { ANY_LIVE } from "../src/config";
import { NEEDS_USER } from "../src/links";
import { getSavedUserId } from "../src/session";
import { colors } from "../src/theme";

const convex = ANY_LIVE
  ? new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, { unsavedChangesWarning: false })
  : null;

function DataProvider({ children }: { children: ReactNode }) {
  return convex ? <ConvexProvider client={convex}>{children}</ConvexProvider> : children;
}

// A deep link can open any screen directly. Without a saved user, onboard first, then continue there.
function OnboardFirst() {
  const pathname = usePathname();
  useEffect(() => {
    if (!NEEDS_USER.test(pathname)) return;
    let current = true;
    getSavedUserId().then((userId) => {
      if (current && !userId) router.replace({ pathname: "/onboarding", params: { next: pathname } });
    });
    return () => {
      current = false;
    };
  }, [pathname]);
  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlayfairDisplay_500Medium,
    PlayfairDisplay_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  // Wait for the fonts (or fall back to system fonts if they fail to load)
  if (!fontsLoaded && !fontError) return null;

  return (
    <DataProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
      <OnboardFirst />
      <NotificationBanner />
    </DataProvider>
  );
}
