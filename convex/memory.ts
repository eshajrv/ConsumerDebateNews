// convex/memory.ts
// Supermemory: Practify's memory of each person's views over time.
//   - After every conversation, we remember where each person stood, how their partner
//     summarized them, and how well they understood their partner.
//   - Then we read those memories back and write one personal insight per person,
//     shown on the Results screen ("You're most open on tech topics").
// Each person's memories live in their own namespace (user_<id>), so nothing is shared
// between users. Insights are only ever shown to the person they're about.
//
// Setup: `npm install supermemory` and set SUPERMEMORY_API_KEY in the Convex dashboard.
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { Supermemory } from "supermemory";
import { askClaude } from "./lib/claude";

const ns = (userId: string) => `user_${userId}`;

// New memories take ~10 seconds to become searchable, so re-rank the feed a bit later
const RANK_DELAY_MS = 15_000;

const lean = (position: number, sideA: string, sideB: string) => {
  if (position <= 20) return `strongly "${sideA}"`;
  if (position < 45) return `leaning "${sideA}"`;
  if (position <= 55) return "undecided";
  if (position < 80) return `leaning "${sideB}"`;
  return `strongly "${sideB}"`;
};

export const context = internalQuery({
  args: { summaryId: v.id("summaries") },
  handler: async (ctx, { summaryId }) => {
    const s = await ctx.db.get(summaryId);
    if (!s || s.gotMeRating === undefined) return null;
    let topicId: Id<"topics">;
    let aboutPosition: number;
    if (s.roomId) {
      const roomId = s.roomId;
      const room = await ctx.db.get(roomId);
      const member = await ctx.db
        .query("roomMembers")
        .withIndex("by_room_and_user", (q) => q.eq("roomId", roomId).eq("userId", s.aboutUserId))
        .unique();
      if (!room || !member) return null;
      topicId = room.topicId;
      aboutPosition = member.position;
    } else {
      const c = s.conversationId && (await ctx.db.get(s.conversationId));
      if (!c) return null;
      topicId = c.topicId;
      aboutPosition = s.aboutUserId === c.userA ? c.positionA : c.positionB;
    }
    const [topic, author, about] = await Promise.all([
      ctx.db.get(topicId),
      ctx.db.get(s.authorId),
      ctx.db.get(s.aboutUserId),
    ]);
    if (!topic || !author || !about) return null;
    return {
      date: topic.date,
      category: topic.category,
      question: topic.question,
      sideA: topic.sideA,
      sideB: topic.sideB,
      aboutId: about._id,
      aboutName: about.name,
      aboutPosition,
      authorId: author._id,
      authorName: author.name,
      humanText: s.humanText,
      rating: s.gotMeRating,
      couldntTell: s.subjectGuess !== (s.humanIsFirst ? "first" : "second"),
    };
  },
});

// Runs after someone rates a summary (summaryId), or after a room member says where they stand
// now (shift), so Supermemory tracks how each person's views change.
export const remember = internalAction({
  args: {
    summaryId: v.optional(v.id("summaries")),
    shift: v.optional(
      v.object({
        roomId: v.id("rooms"),
        userId: v.id("users"),
        name: v.string(),
        date: v.string(),
        category: v.string(),
        question: v.string(),
        sideA: v.string(),
        sideB: v.string(),
        before: v.number(),
        after: v.number(),
      }),
    ),
  },
  handler: async (ctx, { summaryId, shift }) => {
    if (shift) {
      const s = shift;
      const moved = Math.abs(s.after - s.before) >= 10;
      try {
        await new Supermemory().add(ns(s.userId), {
          id: `${s.roomId}-${s.userId}-shift`,
          dreaming: "instant", // searchable right away
          content:
            `On ${s.date}, after a group conversation about the ${s.category} question "${s.question}", ` +
            `${s.name} went from ${lean(s.before, s.sideA, s.sideB)} (${s.before}/100) to ` +
            `${lean(s.after, s.sideA, s.sideB)} (${s.after}/100)` +
            (moved ? ", so the conversation changed their mind." : ", so their view held steady."),
        });
      } catch (e) {
        console.log(`Supermemory add failed: ${(e as Error).message}`);
        return;
      }
      await ctx.scheduler.runAfter(0, internal.memory.updateInsight, { userId: s.userId });
      await ctx.scheduler.runAfter(RANK_DELAY_MS, internal.feed.rankForUser, { userId: s.userId });
      return;
    }
    if (!summaryId) return;
    const d = await ctx.runQuery(internal.memory.context, { summaryId });
    if (!d) return;
    try {
      const client = new Supermemory();
      // About the person whose view was summarized
      await client.add(ns(d.aboutId), {
        id: `${summaryId}-view`,
        dreaming: "instant",
        content:
          `On ${d.date}, ${d.aboutName} discussed the ${d.category} question "${d.question}" ` +
          `and was ${lean(d.aboutPosition, d.sideA, d.sideB)}. ` +
          `Their conversation partner summarized their view as: "${d.humanText}". ` +
          `${d.aboutName} rated that summary ${d.rating} out of 5 for understanding them.`,
      });
      // About the person who wrote the summary (how well they listen)
      await client.add(ns(d.authorId), {
        id: `${summaryId}-listening`,
        dreaming: "instant",
        content:
          `On ${d.date}, ${d.authorName} talked with someone who disagreed with them about the ` +
          `${d.category} question "${d.question}". ${d.authorName} summarized the other person's ` +
          `view and was rated ${d.rating} out of 5 for understanding them` +
          (d.couldntTell ? ", and their summary was as fair as the AI's." : "."),
      });
    } catch (e) {
      console.log(`Supermemory add failed: ${(e as Error).message}`);
      return;
    }
    await ctx.scheduler.runAfter(0, internal.memory.updateInsight, { userId: d.aboutId });
    await ctx.scheduler.runAfter(0, internal.memory.updateInsight, { userId: d.authorId });
    // What they engage with just changed, so re-rank today's feed for both people
    await ctx.scheduler.runAfter(RANK_DELAY_MS, internal.feed.rankForUser, { userId: d.aboutId });
    await ctx.scheduler.runAfter(RANK_DELAY_MS, internal.feed.rankForUser, { userId: d.authorId });
  },
});

// Reads a person's memories and writes one short, encouraging insight for their Results screen.
export const updateInsight = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.runQuery(internal.memory.userName, { userId });
    if (!user) return;
    let memories: string[] = [];
    try {
      const client = new Supermemory();
      const { results } = await client.search(ns(userId), {
        query: `How have ${user}'s views changed, which topics are they most open on, and how well do they understand people who disagree?`,
        limit: 10,
      });
      memories = results.map((r) => r.memory ?? r.chunk ?? "").filter((m) => m.length > 0);
    } catch (e) {
      console.log(`Supermemory search failed: ${(e as Error).message}`);
      return;
    }
    if (memories.length < 2) return; // need some history before saying anything

    const prompt = `Here is what we know about ${user} from their past conversations on Practify,
an app where people talk with someone who sees the news differently:
${memories.map((m) => `- ${m}`).join("\n")}

Write ONE short sentence (under 20 words) addressed to ${user} ("You...") with a specific,
encouraging insight about how they think or listen: a pattern, a change, or a strength.
Only use what's above. No judgment of their opinions. Return only the sentence.`;
    try {
      const insight = (await askClaude(prompt, 80)).trim().replace(/^"|"$/g, "");
      await ctx.runMutation(internal.memory.setInsight, { userId, insight });
    } catch (e) {
      console.log(`Insight failed: ${(e as Error).message}`);
    }
  },
});

export const userName = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => (await ctx.db.get(userId))?.name ?? null,
});

export const setInsight = internalMutation({
  args: { userId: v.id("users"), insight: v.string() },
  handler: async (ctx, { userId, insight }) => {
    await ctx.db.patch(userId, { insight: insight.slice(0, 200) });
  },
});

// Checks the Supermemory key and connection end to end:
//   npx convex run memory:selfTest
// Adds a test memory to "user_selftest", waits 5 seconds, searches for it, and logs PASS or FAIL.
export const selfTest = internalAction({
  args: {},
  handler: async () => {
    const namespace = "user_selftest";
    const marker = `speak-easy self test ${Date.now()}`;
    try {
      const client = new Supermemory();
      await client.add(namespace, {
        id: "selftest",
        content: `Self test: ${marker}. The tester likes talking about air traffic control.`,
        dreaming: "instant",
      });
      // "instant" memories still take ~10 seconds to index, so retry for up to 30 seconds
      let found: string[] = [];
      for (let waited = 5; waited <= 30 && !found.some((m) => m.includes(marker)); waited += 5) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        const { results } = await client.search(namespace, { query: "What does the tester like talking about?", limit: 5 });
        found = results.map((r) => r.memory ?? r.chunk ?? "").filter((m) => m.length > 0);
        console.log(`selfTest: after ${waited}s, ${found.length} result(s)`);
      }
      if (!found.some((m) => m.includes(marker))) {
        console.log(`Supermemory selfTest FAIL: the memory was added but search didn't return it after 30s (found ${JSON.stringify(found)})`);
        return { ok: false, found };
      }
      console.log(`Supermemory selfTest PASS: found ${found.length} result(s): ${JSON.stringify(found)}`);
      return { ok: true, found };
    } catch (e) {
      console.log(`Supermemory selfTest FAIL: ${(e as Error).message}`);
      return { ok: false, error: (e as Error).message };
    }
  },
});
