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
import { Supermemory } from "supermemory";
import { askClaude } from "./lib/claude";

const ns = (userId: string) => `user_${userId}`;

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
    const c = await ctx.db.get(s.conversationId);
    if (!c) return null;
    const [topic, author, about] = await Promise.all([
      ctx.db.get(c.topicId),
      ctx.db.get(s.authorId),
      ctx.db.get(s.aboutUserId),
    ]);
    if (!topic || !author || !about) return null;
    const aboutPosition = s.aboutUserId === c.userA ? c.positionA : c.positionB;
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

// Runs after someone rates a summary. Stores one memory for each of the two people.
export const remember = internalAction({
  args: { summaryId: v.id("summaries") },
  handler: async (ctx, { summaryId }) => {
    const d = await ctx.runQuery(internal.memory.context, { summaryId });
    if (!d) return;
    try {
      const client = new Supermemory();
      // About the person whose view was summarized
      await client.add(ns(d.aboutId), {
        id: `${summaryId}-view`,
        content:
          `On ${d.date}, ${d.aboutName} discussed the ${d.category} question "${d.question}" ` +
          `and was ${lean(d.aboutPosition, d.sideA, d.sideB)}. ` +
          `Their conversation partner summarized their view as: "${d.humanText}". ` +
          `${d.aboutName} rated that summary ${d.rating} out of 5 for understanding them.`,
      });
      // About the person who wrote the summary (how well they listen)
      await client.add(ns(d.authorId), {
        id: `${summaryId}-listening`,
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
