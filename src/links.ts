import { type Href, router } from "expo-router";
import { Linking } from "react-native";

const SCHEME = "practify://";

// Routes that only make sense for someone who has onboarded. A deep link to one of these on a
// phone with no saved user goes through onboarding first.
export const NEEDS_USER = /^\/(home|inbox|leaderboard|topic|room)(\/|$)/;

export function openLink(link: string) {
  if (link.startsWith(SCHEME)) router.push(`/${link.slice(SCHEME.length)}` as Href);
  else Linking.openURL(link);
}

export function afterOnboarding(next: string | undefined): Href {
  return next && NEEDS_USER.test(next) ? (next as Href) : "/home";
}
