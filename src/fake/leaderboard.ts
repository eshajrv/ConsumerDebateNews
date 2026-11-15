import type { Id, LeaderboardPeriod } from "../data/types";
import { fakeUsers } from "./users";

export function myRank({ userId }: { userId: Id; period: LeaderboardPeriod }): number | null {
  const me = fakeUsers.find((u) => u._id === userId);
  if (!me) return null;
  return 1 + fakeUsers.filter((u) => u._id !== userId && (u.totalPoints ?? 0) > (me.totalPoints ?? 0)).length;
}
