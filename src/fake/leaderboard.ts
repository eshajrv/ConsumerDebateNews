import type { Id, LeaderboardEntry, LeaderboardPeriod } from "../data/types";
import { fakeUsers } from "./users";

const PLAYERS: { userId: Id; name: string; today: number; week: number; goodFaithScore: number }[] = [
  { userId: "user_priya", name: "Priya", today: 64, week: 310, goodFaithScore: 71 },
  { userId: "user_maya", name: "Maya", today: 48, week: 180, goodFaithScore: 62 },
  { userId: "user_leo", name: "Leo", today: 22, week: 120, goodFaithScore: 58 },
  { userId: "user_jordan", name: "Jordan", today: 30, week: 90, goodFaithScore: 55 },
  { userId: "user_sam", name: "Sam", today: 12, week: 40, goodFaithScore: 48 },
  { userId: "user_amara", name: "Amara", today: 72, week: 295, goodFaithScore: 78 },
  { userId: "user_diego", name: "Diego", today: 40, week: 260, goodFaithScore: 66 },
  { userId: "user_hana", name: "Hana", today: 56, week: 240, goodFaithScore: 74 },
  { userId: "user_marcus", name: "Marcus", today: 18, week: 225, goodFaithScore: 52 },
  { userId: "user_sofia", name: "Sofia", today: 60, week: 210, goodFaithScore: 69 },
  { userId: "user_eli", name: "Eli", today: 34, week: 198, goodFaithScore: 61 },
  { userId: "user_noor", name: "Noor", today: 44, week: 172, goodFaithScore: 80 },
  { userId: "user_tyler", name: "Tyler", today: 8, week: 165, goodFaithScore: 45 },
  { userId: "user_grace", name: "Grace", today: 52, week: 158, goodFaithScore: 72 },
  { userId: "user_omar", name: "Omar", today: 26, week: 150, goodFaithScore: 59 },
  { userId: "user_lucia", name: "Lucia", today: 38, week: 141, goodFaithScore: 64 },
  { userId: "user_ben", name: "Ben", today: 14, week: 133, goodFaithScore: 50 },
  { userId: "user_aisha", name: "Aisha", today: 46, week: 127, goodFaithScore: 76 },
  { userId: "user_kenji", name: "Kenji", today: 20, week: 112, goodFaithScore: 57 },
  { userId: "user_zoe", name: "Zoe", today: 28, week: 104, goodFaithScore: 63 },
  { userId: "user_ravi", name: "Ravi", today: 10, week: 96, goodFaithScore: 54 },
  { userId: "user_chloe", name: "Chloe", today: 16, week: 82, goodFaithScore: 60 },
  { userId: "user_mateo", name: "Mateo", today: 6, week: 70, goodFaithScore: 49 },
  { userId: "user_ivy", name: "Ivy", today: 24, week: 58, goodFaithScore: 67 },
  { userId: "user_dev", name: "Dev", today: 4, week: 36, goodFaithScore: 47 },
];

const ranked = (period: LeaderboardPeriod): LeaderboardEntry[] =>
  PLAYERS.map((p) => ({ userId: p.userId, name: p.name, points: p[period], goodFaithScore: p.goodFaithScore }))
    .sort((a, b) => b.points - a.points)
    .map((p, i) => ({ ...p, rank: i + 1 }));

export function top({ period }: { period: LeaderboardPeriod }): LeaderboardEntry[] {
  return ranked(period).slice(0, 20);
}

export function myRank({ userId, period }: { userId: Id; period: LeaderboardPeriod }): LeaderboardEntry | null {
  const board = ranked(period);
  const mine = board.find((e) => e.userId === userId);
  if (mine) return mine;
  const user = fakeUsers.find((u) => u._id === userId);
  if (!user) return null;
  return { rank: board.length + 1, userId, name: user.name, points: 0, goodFaithScore: user.goodFaithScore };
}
