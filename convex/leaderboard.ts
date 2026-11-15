// convex/leaderboard.ts
// Leaderboard: points from "Here's what I heard" summaries, by Pacific day or the last 7 days.
// Points are mirrored into dailyPoints (one row per user per day) when a summary is rated,
// so the leaderboard reads a small indexed table instead of every summary.
import { query, MutationCtx, QueryCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { pacificDate } from "./dailyTopics";

const TOP = 20;
const period = v.union(v.literal("today"), v.literal("week"));

// Called from summaries.rate when points are awarded
export async function addDailyPoints(ctx: MutationCtx, userId: Id<"users">, points: number) {
  const date = pacificDate(new Date(Date.now()));
  const row = await ctx.db
    .query("dailyPoints")
    .withIndex("by_user_and_date", (q) => q.eq("userId", userId).eq("date", date))
    .unique();
  if (row) await ctx.db.patch(row._id, { points: row.points + points });
  else await ctx.db.insert("dailyPoints", { userId, date, points });
}

// "today" -> [date]; "week" -> date and the 6 days before it
function datesFor(p: "today" | "week", date: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(`${date}T12:00:00Z`))) {
    throw new ConvexError("That date doesn't look right.");
  }
  const days = p === "today" ? 1 : 7;
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(`${date}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - i);
    return d.toISOString().slice(0, 10);
  });
}

// Every user's total for the period, highest first, with ties sharing a rank
async function standings(ctx: QueryCtx, p: "today" | "week", date: string) {
  const totals = new Map<Id<"users">, number>();
  for (const day of datesFor(p, date)) {
    const rows = await ctx.db
      .query("dailyPoints")
      .withIndex("by_date_and_points", (q) => q.eq("date", day))
      .collect();
    for (const r of rows) totals.set(r.userId, (totals.get(r.userId) ?? 0) + r.points);
  }
  const sorted = [...totals.entries()].filter(([, pts]) => pts > 0).sort((a, b) => b[1] - a[1]);
  let rank = 0;
  return sorted.map(([userId, points], i) => {
    if (i === 0 || points < sorted[i - 1][1]) rank = i + 1;
    return { userId, points, rank };
  });
}

export const top = query({
  args: { period, date: v.string() },
  handler: async (ctx, { period, date }) => {
    const rows = (await standings(ctx, period, date)).slice(0, TOP);
    return Promise.all(rows.map(async (r) => ({ ...r, name: (await ctx.db.get(r.userId))?.name ?? "" })));
  },
});

export const myRank = query({
  args: { userId: v.id("users"), period, date: v.string() },
  handler: async (ctx, { userId, period, date }) => {
    const me = (await standings(ctx, period, date)).find((r) => r.userId === userId);
    return { rank: me?.rank ?? null, points: me?.points ?? 0 };
  },
});
