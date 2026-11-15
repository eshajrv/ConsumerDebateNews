// convex/notifications.ts
// The in-app inbox: the bell's unread count, the list, and marking things read.
import { internalMutation, mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { notify } from "./notify";

const MAX = 50;
const PACIFIC_HOUR = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  hour: "numeric",
  hourCycle: "h23",
});

// Newest first (max 50), plus how many are unread
export const mine = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_and_read", (q) => q.eq("userId", userId).eq("read", false))
      .order("desc")
      .collect();
    const read = await ctx.db
      .query("notifications")
      .withIndex("by_user_and_read", (q) => q.eq("userId", userId).eq("read", true))
      .order("desc")
      .take(MAX);
    const notifications = [...unread, ...read].sort((a, b) => b._creationTime - a._creationTime).slice(0, MAX);
    return { notifications, unreadCount: unread.length };
  },
});

export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, { notificationId }) => {
    const n = await ctx.db.get(notificationId);
    if (!n) throw new ConvexError("That notification doesn't exist anymore.");
    if (!n.read) await ctx.db.patch(notificationId, { read: true });
  },
});

export const markAllRead = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_and_read", (q) => q.eq("userId", userId).eq("read", false))
      .collect();
    for (const n of unread) await ctx.db.patch(n._id, { read: true });
  },
});

// Cron: "Your feed is ready" for every user at 8 AM Pacific. The cron fires at both 15:00 and
// 16:00 UTC so it hits 8 AM in winter and summer; only the run that lands at 8 AM Pacific sends.
export const feedReady = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (Number(PACIFIC_HOUR.format(Date.now())) !== 8) return;
    for await (const user of ctx.db.query("users")) {
      await notify(ctx, user._id, "Your feed is ready: 4 topics for today.", "practify://");
    }
  },
});
