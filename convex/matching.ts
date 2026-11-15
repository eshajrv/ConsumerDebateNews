// convex/matching.ts
// Automatic matching: pairs you with the waiting person whose view is furthest from yours.
// Convex mutations are transactional, so two people can't grab the same match.
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const CONVERSATION_MS = 5 * 60 * 1000; // 5-minute conversations
const MIN_GAP = 25; // positions must differ by at least this much (out of 100)
const QUEUE_TIMEOUT_MS = 2 * 60 * 1000; // ignore people who've been waiting too long (likely left)

export const findMatch = mutation({
  args: {
    userId: v.id("users"),
    topicId: v.id("topics"),
    allowSpectators: v.boolean(),
  },
  handler: async (ctx, { userId, topicId, allowSpectators }) => {
    const stance = await ctx.db
      .query("stances")
      .withIndex("by_user_topic", (q) => q.eq("userId", userId).eq("topicId", topicId))
      .unique();
    if (!stance) throw new Error("Set where you stand first");

    // Clear any earlier queue entry for this user
    const old = await ctx.db
      .query("queue")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const o of old) await ctx.db.delete(o._id);

    // Find the waiting person with the most different view
    const now = Date.now();
    const waiting = await ctx.db
      .query("queue")
      .withIndex("by_topic", (q) => q.eq("topicId", topicId))
      .collect();
    let best = null;
    let bestGap = MIN_GAP - 1;
    for (const w of waiting) {
      if (w.userId === userId) continue;
      if (now - w._creationTime > QUEUE_TIMEOUT_MS) continue;
      const gap = Math.abs(w.position - stance.position);
      if (gap > bestGap) {
        best = w;
        bestGap = gap;
      }
    }

    if (!best) {
      await ctx.db.insert("queue", { userId, topicId, position: stance.position, allowSpectators });
      return { status: "waiting" as const };
    }

    await ctx.db.delete(best._id);
    const conversationId = await ctx.db.insert("conversations", {
      topicId,
      userA: best.userId,
      userB: userId,
      positionA: best.position,
      positionB: stance.position,
      status: "live",
      endsAt: now + CONVERSATION_MS,
      allowSpectators: best.allowSpectators && allowSpectators,
    });
    await ctx.scheduler.runAfter(0, internal.ai.generateOpener, { conversationId });
    await ctx.scheduler.runAfter(CONVERSATION_MS, internal.conversations.end, { conversationId });
    return { status: "matched" as const, conversationId };
  },
});

export const cancel = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const entries = await ctx.db
      .query("queue")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const e of entries) await ctx.db.delete(e._id);
  },
});

// The waiting screen subscribes to this. When it returns a conversation, go to the chat.
// Because Convex queries are live, the person who was waiting gets matched instantly.
export const myActiveConversation = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const asA = await ctx.db
      .query("conversations")
      .withIndex("by_userA", (q) => q.eq("userA", userId))
      .order("desc")
      .first();
    const asB = await ctx.db
      .query("conversations")
      .withIndex("by_userB", (q) => q.eq("userB", userId))
      .order("desc")
      .first();
    const active = [asA, asB].filter((c) => c && c.status !== "done");
    active.sort((a, b) => b!._creationTime - a!._creationTime);
    return active[0] ?? null;
  },
});
