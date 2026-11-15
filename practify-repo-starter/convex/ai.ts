// convex/ai.ts
// AI's three jobs: start the conversation, write the comparison summary, rate civility.
// AI never talks for anyone. It only helps real people talk to each other.
import { internalAction, internalQuery } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import { askClaude, extractJson } from "./lib/claude";

const describe = (position: number, sideA: string, sideB: string) => {
  if (position <= 20) return `strongly "${sideA}"`;
  if (position < 45) return `leaning "${sideA}"`;
  if (position <= 55) return "in the middle";
  if (position < 80) return `leaning "${sideB}"`;
  return `strongly "${sideB}"`;
};

export const generateOpener = internalAction({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const c = await ctx.runQuery(api.conversations.get, { conversationId });
    if (!c || !c.topic) return;
    const t = c.topic;
    const prompt = `Two people are about to have a short, friendly conversation about this question:
"${t.question}"

${c.nameA} is ${describe(c.positionA, t.sideA, t.sideB)}.
${c.nameB} is ${describe(c.positionB, t.sideA, t.sideB)}.

Write an opener of at most 2 short sentences:
1. Name one thing they probably both care about or agree on.
2. Ask one of them (by first name) a curious, open question about why they see it the way they do.
Warm and casual. Don't take a side. Return only the opener text.`;
    const opener = (await askClaude(prompt, 200)).trim();
    await ctx.runMutation(internal.conversations.setOpener, { conversationId, opener });
  },
});

export const writeAiSummary = internalAction({
  args: { summaryId: v.id("summaries") },
  handler: async (ctx, { summaryId }) => {
    const data = await ctx.runQuery(internal.summaries.contextFor, { summaryId });
    if (!data) return;
    const words = data.humanText.split(/\s+/).length;
    const prompt = `In a conversation about "${data.question}", ${data.aboutName} said:
${data.theirMessages.map((m) => `- ${m}`).join("\n") || "- (very little)"}

Summarize ${data.aboutName}'s view in ONE sentence, addressed to them (start with "You").
Match this style so it's hard to tell apart from a human's summary:
"${data.humanText}"
Use about ${words} words, the same casual tone, no quotes, no hedging phrases like "it seems".
Return only the sentence.`;
    const aiText = (await askClaude(prompt, 150)).trim().replace(/^"|"$/g, "");
    await ctx.runMutation(internal.summaries.setAiText, { summaryId, aiText });
  },
});

export const transcript = internalQuery({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const c = await ctx.db.get(conversationId);
    if (!c) return null;
    const msgs = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .collect();
    return { userA: c.userA, msgs: msgs.map((m) => ({ fromA: m.userId === c.userA, text: m.text })) };
  },
});

export const rateCivility = internalAction({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const data = await ctx.runQuery(internal.ai.transcript, { conversationId });
    if (!data || data.msgs.length === 0) return;
    const lines = data.msgs.map((m) => `${m.fromA ? "A" : "B"}: ${m.text}`).join("\n");
    const prompt = `Rate how constructive each person was in this disagreement, 1-5.
5 = curious, respectful, engages with the other's points. 1 = insults, mockery, bad faith.
Disagreeing strongly is fine; only rate HOW they disagreed.

${lines}

Return ONLY JSON: {"A": number, "B": number}`;
    try {
      const r = extractJson<{ A: number; B: number }>(await askClaude(prompt, 50));
      const clamp = (n: number) => Math.max(1, Math.min(5, Math.round(n)));
      await ctx.runMutation(internal.conversations.setCivility, {
        conversationId,
        civilityA: clamp(r.A),
        civilityB: clamp(r.B),
      });
    } catch {
      console.log("Civility rating failed; skipping");
    }
  },
});
