import { ConvexProvider, ConvexReactClient } from "convex/react";
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
  return (
    <DataProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
      <OnboardFirst />
      <NotificationBanner />
    </DataProvider>
  );
}
