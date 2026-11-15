// convex/feed.ts
// Each person's daily feed: the shared topic first, then 2 topics they want to learn about
// and 1 from a category outside both of their lists.
// Personalization picks WHICH topics you see, never which side: stances are never used here.
//   - feed.rank (action) asks Supermemory what the user engages with, has Claude order the
//     9 non-shared topics, and saves that order for today.
//   - feed.forUser fills the slots, using the saved order within each slot if there is one.
import { action, internalMutation, internalQuery, query, QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { Supermemory } from "supermemory";
import { askClaude, extractJson } from "./lib/claude";
import { liveTopics, pacificDate } from "./dailyTopics";

const LEARN_PICKS = 2; // topics from categories the user wants to learn more about
const STRETCH_PICKS = 1; // a topic from a category in neither of their lists
const PICKS_PER_USER = LEARN_PICKS + STRETCH_PICKS;

// The shared topic, then 2 "want to learn" topics, then 1 stretch topic.
// A saved feed.rank order decides which topic wins within each slot; with no saved order
// the generation order is used. A slot that can't be filled takes the best remaining topic.
// Stances are never read here.
export async function feedForUser(ctx: QueryCtx, userId: Id<"users">, date: string) {
  const topics = await liveTopics(ctx, date);
  const shared = topics.find((t) => t.isShared === true);
  const others = topics.filter((t) => t !== shared);

  const saved = await ctx.db
    .query("feedOrders")
    .withIndex("by_user_and_date", (q) => q.eq("userId", userId).eq("date", date))
    .unique();

  let ranked: Doc<"topics">[] = others;
  if (saved) {
    const byId = new Map(others.map((t) => [t._id, t]));
    const inOrder = saved.topicIds.flatMap((id) => byId.get(id) ?? []);
    ranked = [...inOrder, ...others.filter((t) => !saved.topicIds.includes(t._id))];
  }

  const user = await ctx.db.get(userId);
  const lower = (list?: string[]) => new Set((list ?? []).map((i) => i.toLowerCase()));
  const learn = lower(user?.wantToLearn?.length ? user.wantToLearn : user?.interests);
  const know = lower(user?.knowWell);
  const cat = (t: Doc<"topics">) => t.category.toLowerCase();

  const chosen: Doc<"topics">[] = [];
  const take = (n: number, fits: (t: Doc<"topics">) => boolean) => {
    for (const t of ranked) {
      if (n === 0) break;
      if (!chosen.includes(t) && fits(t)) {
        chosen.push(t);
        n--;
      }
    }
  };
  take(LEARN_PICKS, (t) => learn.has(cat(t)));
  take(STRETCH_PICKS, (t) => !learn.has(cat(t)) && !know.has(cat(t)));
  take(PICKS_PER_USER - chosen.length, () => true); // fill any empty slot

  return shared ? [shared, ...chosen] : chosen;
}

export const forUser = query({
  args: { userId: v.id("users"), date: v.string() },
  handler: async (ctx, { userId, date }) => feedForUser(ctx, userId, date),
});

export const rank = action({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const date = pacificDate();
    const data = await ctx.runQuery(internal.feed.rankContext, { userId, date });
    if (!data || data.topics.length === 0) return null;

    let memories: string[];
    try {
      const { results } = await new Supermemory().search(`user_${userId}`, {
        query: `Which news topics and categories does ${data.name} engage with and care about?`,
        limit: 10,
      });
      memories = results.map((r) => r.memory ?? r.chunk ?? "").filter((m) => m.length > 0);
    } catch (e) {
      console.log(`feed.rank: Supermemory search failed: ${(e as Error).message}`);
      return null;
    }
    if (memories.length === 0) return null; // nothing to go on; forUser uses interests

    const prompt = `You order a news feed for ${data.name} by how interesting each topic will be to them.
Use only what they engage with, never which side they are on.

What we know about what they engage with:
${memories.map((m) => `- ${m}`).join("\n")}

Their picked interests: ${JSON.stringify(data.interests)}

Topics:
${data.topics.map((t) => `- id ${t.id} [${t.category}] ${t.question}`).join("\n")}

Return ONLY a JSON array of all the topic ids, most interesting first.`;

    let order: string[];
    try {
      order = extractJson<string[]>(await askClaude(prompt, 600));
    } catch (e) {
      console.log(`feed.rank: Claude failed: ${(e as Error).message}`);
      return null;
    }
    if (!Array.isArray(order)) return null;

    const known = data.topics.map((t) => t.id);
    const ranked = [...new Set(order)].filter((id): id is Id<"topics"> => known.includes(id as Id<"topics">));
    const topicIds = [...ranked, ...known.filter((id) => !ranked.includes(id))];
    await ctx.runMutation(internal.feed.saveOrder, { userId, date, topicIds });
    return null;
  },
});

export const rankContext = internalQuery({
  args: { userId: v.id("users"), date: v.string() },
  handler: async (ctx, { userId, date }) => {
    const user = await ctx.db.get(userId);
    if (!user) return null;
    const topics = await ctx.db
      .query("topics")
      .withIndex("by_date_status", (q) => q.eq("date", date).eq("status", "live"))
      .take(50);
    return {
      name: user.name,
      interests: user.interests ?? [],
      topics: topics
        .filter((t) => t.isShared !== true)
        .map((t) => ({ id: t._id, category: t.category, question: t.question })),
    };
  },
});

export const saveOrder = internalMutation({
  args: { userId: v.id("users"), date: v.string(), topicIds: v.array(v.id("topics")) },
  handler: async (ctx, { userId, date, topicIds }) => {
    const existing = await ctx.db
      .query("feedOrders")
      .withIndex("by_user_and_date", (q) => q.eq("userId", userId).eq("date", date))
      .unique();
    if (existing) await ctx.db.patch(existing._id, { topicIds });
    else await ctx.db.insert("feedOrders", { userId, date, topicIds });
  },
});
