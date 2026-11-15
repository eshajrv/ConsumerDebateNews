// convex/conversations.ts
// Chat, the 5-minute timer, spectating, and reactions.
import { internalMutation, mutation, query, MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

export const get = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const c = await ctx.db.get(conversationId);
    if (!c) return null;
    const [userA, userB, topic] = await Promise.all([
      ctx.db.get(c.userA),
      ctx.db.get(c.userB),
      ctx.db.get(c.topicId),
    ]);
    return { ...c, nameA: userA?.name ?? "", nameB: userB?.name ?? "", topic };
  },
});

export const messages = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) =>
    ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .collect(),
});

export const send = mutation({
  args: { conversationId: v.id("conversations"), userId: v.id("users"), text: v.string() },
  handler: async (ctx, { conversationId, userId, text }) => {
    const c = await ctx.db.get(conversationId);
    if (!c || c.status !== "live") throw new Error("This conversation has ended");
    if (userId !== c.userA && userId !== c.userB) throw new Error("Only participants can send messages");
    const clean = text.trim().slice(0, 500);
    if (!clean) return;
    await ctx.db.insert("messages", { conversationId, userId, text: clean });
  },
});

async function endConversation(ctx: MutationCtx, conversationId: Id<"conversations">) {
  const c = await ctx.db.get(conversationId);
  if (!c || c.status !== "live") return;
  await ctx.db.patch(conversationId, { status: "summarizing" });
  await ctx.scheduler.runAfter(0, internal.ai.rateCivility, { conversationId });
}

// Runs automatically when the 5-minute timer is up
export const end = internalMutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => endConversation(ctx, conversationId),
});

// Either participant can wrap up early
export const endEarly = mutation({
  args: { conversationId: v.id("conversations"), userId: v.id("users") },
  handler: async (ctx, { conversationId, userId }) => {
    const c = await ctx.db.get(conversationId);
    if (!c || (userId !== c.userA && userId !== c.userB)) throw new Error("Not your conversation");
    await endConversation(ctx, conversationId);
  },
});

export const setOpener = internalMutation({
  args: { conversationId: v.id("conversations"), opener: v.string() },
  handler: async (ctx, { conversationId, opener }) => {
    await ctx.db.patch(conversationId, { opener });
  },
});

// Saves the AI civility ratings and nudges each person's good-faith score
export const setCivility = internalMutation({
  args: { conversationId: v.id("conversations"), civilityA: v.number(), civilityB: v.number() },
  handler: async (ctx, { conversationId, civilityA, civilityB }) => {
    const c = await ctx.db.get(conversationId);
    if (!c) return;
    await ctx.db.patch(conversationId, { civilityA, civilityB });
    for (const [userId, civ] of [[c.userA, civilityA], [c.userB, civilityB]] as const) {
      const u = await ctx.db.get(userId);
      if (!u) continue;
      const score = Math.max(0, Math.min(100, u.goodFaithScore + (civ - 3) * 2));
      await ctx.db.patch(userId, { goodFaithScore: score });
    }
  },
});

// ---------- Spectating ----------

// "Watch live" list for a topic
export const live = query({
  args: { topicId: v.id("topics") },
  handler: async (ctx, { topicId }) => {
    const convos = await ctx.db
      .query("conversations")
      .withIndex("by_topic_status", (q) => q.eq("topicId", topicId).eq("status", "live"))
      .collect();
    const visible = convos.filter((c) => c.allowSpectators);
    return Promise.all(
      visible.map(async (c) => {
        const [a, b, msgs] = await Promise.all([
          ctx.db.get(c.userA),
          ctx.db.get(c.userB),
          ctx.db
            .query("messages")
            .withIndex("by_conversation", (q) => q.eq("conversationId", c._id))
            .collect(),
        ]);
        return {
          _id: c._id,
          nameA: a?.name ?? "",
          nameB: b?.name ?? "",
          positionA: c.positionA,
          positionB: c.positionB,
          endsAt: c.endsAt,
          messageCount: msgs.length,
        };
      })
    );
  },
});

// Spectators react to messages (participants see these too)
export const react = mutation({
  args: {
    conversationId: v.id("conversations"),
    messageId: v.id("messages"),
    userId: v.id("users"),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.conversationId);
    if (!c || !c.allowSpectators) throw new Error("This conversation isn't open to spectators");
    await ctx.db.insert("reactions", { ...args, emoji: args.emoji.slice(0, 8) });
  },
});

export const reactions = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) =>
    ctx.db
      .query("reactions")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .collect(),
});
