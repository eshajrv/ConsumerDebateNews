// convex/users.ts
// Simple users (first name only for the hackathon; add real auth later).
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) =>
    ctx.db.insert("users", { name: name.trim().slice(0, 30), goodFaithScore: 50, streak: 0 }),
});

export const get = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => ctx.db.get(userId),
});

// Save where the user stands on a topic, and update their daily streak.
// `today` comes from the phone so the streak follows the user's local date.
export const setStance = mutation({
  args: {
    userId: v.id("users"),
    topicId: v.id("topics"),
    position: v.number(),
    today: v.string(), // "YYYY-MM-DD"
  },
  handler: async (ctx, { userId, topicId, position, today }) => {
    const pos = Math.max(0, Math.min(100, Math.round(position)));
    const existing = await ctx.db
      .query("stances")
      .withIndex("by_user_topic", (q) => q.eq("userId", userId).eq("topicId", topicId))
      .unique();
    if (existing) await ctx.db.patch(existing._id, { position: pos });
    else await ctx.db.insert("stances", { userId, topicId, position: pos });

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");
    if (user.lastActiveDate !== today) {
      const d = new Date(`${today}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() - 1);
      const yesterday = d.toISOString().slice(0, 10);
      await ctx.db.patch(userId, {
        streak: user.lastActiveDate === yesterday ? user.streak + 1 : 1,
        lastActiveDate: today,
      });
    }
  },
});
