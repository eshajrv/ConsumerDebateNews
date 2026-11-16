// convex/admin.ts
// Demo reset, run from the terminal or dashboard only (internal):
//   npx convex run admin:resetTables '{"confirm":"RESET"}'
// Deletes every table (room) and everything that hangs off it, resets scores, and removes
// the "Test ..." users. Keeps real users, their stances and the topics.
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { TableNames } from "./_generated/dataModel";

const WIPE: TableNames[] = [
  "rooms",
  "roomMembers",
  "roomMessages",
  "roomWatchers",
  "summaries",
  "summaryVotes",
  "notifications",
  "joinLinks",
  "dailyPoints",
  // old 1-on-1 flow
  "conversations",
  "messages",
  "reactions",
  "queue",
];

const TEST_USERS = ["Test Left", "Test Middle", "Test Right"];

export const resetTables = internalMutation({
  args: { confirm: v.literal("RESET") },
  handler: async (ctx) => {
    const deleted: Record<string, number> = {};
    for (const table of WIPE) {
      let n = 0;
      for await (const row of ctx.db.query(table)) {
        await ctx.db.delete(row._id);
        n++;
      }
      deleted[table] = n;
    }

    let removedTestUsers = 0;
    let resetUsers = 0;
    for await (const user of ctx.db.query("users")) {
      if (TEST_USERS.includes(user.name)) {
        for (const s of await ctx.db
          .query("stances")
          .withIndex("by_user_topic", (q) => q.eq("userId", user._id))
          .collect()) {
          await ctx.db.delete(s._id);
        }
        for (const f of await ctx.db
          .query("feedOrders")
          .withIndex("by_user_and_date", (q) => q.eq("userId", user._id))
          .collect()) {
          await ctx.db.delete(f._id);
        }
        await ctx.db.delete(user._id);
        removedTestUsers++;
        continue;
      }
      await ctx.db.patch(user._id, { totalPoints: 0, goodFaithScore: 50, streak: 0, lastActiveDate: undefined });
      resetUsers++;
    }
    return { deleted, removedTestUsers, resetUsers };
  },
});
