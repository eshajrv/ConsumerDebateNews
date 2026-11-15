import type { Id, LeaderboardEntry, LeaderboardPeriod, MyRank } from "../data/types";

const PLAYERS: { userId: Id; name: string; today: number; week: number }[] = [
  { userId: "user_priya", name: "Priya", today: 64, week: 310 },
  { userId: "user_maya", name: "Maya", today: 48, week: 180 },
  { userId: "user_leo", name: "Leo", today: 22, week: 120 },
  { userId: "user_jordan", name: "Jordan", today: 30, week: 90 },
  { userId: "user_sam", name: "Sam", today: 12, week: 40 },
  { userId: "user_amara", name: "Amara", today: 72, week: 295 },
  { userId: "user_diego", name: "Diego", today: 40, week: 260 },
  { userId: "user_hana", name: "Hana", today: 56, week: 240 },
  { userId: "user_marcus", name: "Marcus", today: 18, week: 225 },
  { userId: "user_sofia", name: "Sofia", today: 60, week: 210 },
  { userId: "user_eli", name: "Eli", today: 34, week: 198 },
  { userId: "user_noor", name: "Noor", today: 44, week: 172 },
  { userId: "user_tyler", name: "Tyler", today: 8, week: 165 },
  { userId: "user_grace", name: "Grace", today: 52, week: 158 },
  { userId: "user_omar", name: "Omar", today: 26, week: 150 },
  { userId: "user_lucia", name: "Lucia", today: 38, week: 141 },
  { userId: "user_ben", name: "Ben", today: 14, week: 133 },
  { userId: "user_aisha", name: "Aisha", today: 46, week: 127 },
  { userId: "user_kenji", name: "Kenji", today: 20, week: 112 },
  { userId: "user_zoe", name: "Zoe", today: 28, week: 104 },
  { userId: "user_ravi", name: "Ravi", today: 10, week: 96 },
  { userId: "user_chloe", name: "Chloe", today: 16, week: 82 },
  { userId: "user_mateo", name: "Mateo", today: 6, week: 70 },
  { userId: "user_ivy", name: "Ivy", today: 24, week: 58 },
  { userId: "user_dev", name: "Dev", today: 4, week: 36 },
];

const ranked = (period: LeaderboardPeriod): LeaderboardEntry[] => {
  const sorted = PLAYERS.map((p) => ({ userId: p.userId, name: p.name, points: p[period] })).sort((a, b) => b.points - a.points);
  let rank = 0;
  return sorted.map((p, i) => {
    if (i === 0 || p.points < sorted[i - 1].points) rank = i + 1;
    return { ...p, rank };
  });
};

export function top({ period }: { period: LeaderboardPeriod; date: string }): LeaderboardEntry[] {
  return ranked(period).slice(0, 20);
}

export function myRank({ userId, period }: { userId: Id; period: LeaderboardPeriod; date: string }): MyRank {
  const mine = ranked(period).find((e) => e.userId === userId);
  return { rank: mine?.rank ?? null, points: mine?.points ?? 0 };
}
