// convex/keiki.ts
// Internal functions behind the Keiki HTTP endpoints in http.ts.
// Every lookup is by the caller's own phone number (already E.164), and nothing here returns a phone number.
import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { pacificDate, topicStats } from "./dailyTopics";
import { feedForUser } from "./feed";
import { joinRoom } from "./rooms";
import { createJoinLink } from "./links";
import { saveStance, userByPhone } from "./users";

export const feed = internalQuery({
  args: { phone: v.string() },
  handler: async (ctx, { phone }) => {
    const user = await userByPhone(ctx, phone);
    if (!user) return null;
    const date = pacificDate();
    const topics = await feedForUser(ctx, user._id, date);
    return {
      date,
      topics: await Promise.all(
        topics.map(async (t) => {
          const s = await topicStats(ctx, t._id);
          return {
            id: t._id,
            isShared: t.isShared === true,
            category: t.category,
            question: t.question,
            sideA: t.sideA,
            sideB: t.sideB,
            peopleAnswered: s.total,
            leaningA: s.leanA,
            leaningB: s.leanB,
            talkingNow: s.talkingNow,
          };
        }),
      ),
    };
  },
});

export const takeContext = internalQuery({
  args: { phone: v.string(), topicId: v.string() },
  handler: async (ctx, { phone, topicId }) => {
    const user = await userByPhone(ctx, phone);
    const id = ctx.db.normalizeId("topics", topicId);
    const topic = id && (await ctx.db.get(id));
    if (!user || !topic) return null;
    return { userId: user._id, topicId: topic._id, question: topic.question, sideA: topic.sideA, sideB: topic.sideB };
  },
});

export const saveTake = internalMutation({
  args: { userId: v.id("users"), topicId: v.id("topics"), position: v.number(), take: v.string() },
  handler: async (ctx, args) => saveStance(ctx, { ...args, today: pacificDate(), source: "text" }),
});

export const join = internalMutation({
  args: { phone: v.string(), topicId: v.string() },
  handler: async (ctx, { phone, topicId }) => {
    const user = await userByPhone(ctx, phone);
    if (!user) return { error: "user not found" as const };
    const id = ctx.db.normalizeId("topics", topicId);
    if (!id || !(await ctx.db.get(id))) return { error: "topic not found" as const };
    const stance = await ctx.db
      .query("stances")
      .withIndex("by_user_topic", (q) => q.eq("userId", user._id).eq("topicId", id))
      .unique();
    if (!stance) return { error: "no take yet: save their take on this topic first" as const };
    const roomId = await joinRoom(ctx, { userId: user._id, topicId: id });
    const room = await ctx.db.get(roomId);
    const code = await createJoinLink(ctx, user._id, roomId);
    return { roomId, slot: room!.slotStart, code };
  },
});
