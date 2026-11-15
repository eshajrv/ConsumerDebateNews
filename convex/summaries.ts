// convex/summaries.ts
// The "Here's what I heard" game.
// 1. After the chat, each person writes one sentence summarizing the OTHER person's view.
// 2. AI writes its own summary of the same view, matching length and tone.
// 3. The person being summarized sees both (random order) and guesses which one is human.
// 4. Then they rate "Did they get you?" (1-5). Points go to the author.
// Spectators can also guess which summary is human.
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

export const submit = mutation({
  args: { conversationId: v.id("conversations"), authorId: v.id("users"), text: v.string() },
  handler: async (ctx, { conversationId, authorId, text }) => {
    const c = await ctx.db.get(conversationId);
    if (!c) throw new Error("Conversation not found");
    if (c.status === "live") throw new Error("Summaries open when the conversation ends");
    if (authorId !== c.userA && authorId !== c.userB) throw new Error("Not your conversation");
    const clean = text.trim().slice(0, 400);
    if (!clean) throw new Error("Write a sentence first");

    const existing = await ctx.db
      .query("summaries")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .collect();
    if (existing.some((s) => s.authorId === authorId)) throw new Error("You already submitted");

    const summaryId = await ctx.db.insert("summaries", {
      conversationId,
      authorId,
      aboutUserId: authorId === c.userA ? c.userB : c.userA,
      humanText: clean,
      humanIsFirst: Math.random() < 0.5,
    });
    await ctx.scheduler.runAfter(0, internal.ai.writeAiSummary, { summaryId });
  },
});

// What the results screen shows. Never reveals which option is human until the subject guesses.
export const forConversation = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const list = await ctx.db
      .query("summaries")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .collect();
    return list.map((s) => {
      const guessed = s.subjectGuess !== undefined;
      return {
        _id: s._id,
        authorId: s.authorId,
        aboutUserId: s.aboutUserId,
        ready: s.aiText !== undefined,
        options: s.aiText ? (s.humanIsFirst ? [s.humanText, s.aiText] : [s.aiText, s.humanText]) : null,
        subjectGuess: s.subjectGuess ?? null,
        humanIs: guessed ? (s.humanIsFirst ? "first" : "second") : null,
        gotMeRating: s.gotMeRating ?? null,
        points: s.points ?? null,
      };
    });
  },
});

// Step 3: the person being summarized guesses which option a human wrote
export const guess = mutation({
  args: {
    summaryId: v.id("summaries"),
    userId: v.id("users"),
    pick: v.union(v.literal("first"), v.literal("second")),
  },
  handler: async (ctx, { summaryId, userId, pick }) => {
    const s = await ctx.db.get(summaryId);
    if (!s || !s.aiText) throw new Error("Not ready yet");
    if (userId !== s.aboutUserId) throw new Error("Only the person being summarized can guess");
    if (s.subjectGuess) throw new Error("Already guessed");
    await ctx.db.patch(summaryId, { subjectGuess: pick });
  },
});

// Step 4: after the reveal, rate "Did they get you?" and award points
export const rate = mutation({
  args: { summaryId: v.id("summaries"), userId: v.id("users"), gotMeRating: v.number() },
  handler: async (ctx, { summaryId, userId, gotMeRating }) => {
    const s = await ctx.db.get(summaryId);
    if (!s || !s.subjectGuess) throw new Error("Guess first");
    if (userId !== s.aboutUserId) throw new Error("Only the person being summarized can rate");
    if (s.gotMeRating) throw new Error("Already rated");

    const rating = Math.max(1, Math.min(5, Math.round(gotMeRating)));
    const humanIs = s.humanIsFirst ? "first" : "second";
    const couldntTell = s.subjectGuess !== humanIs; // summary was as fair as the AI's
    const points = rating * 10 + (couldntTell ? 20 : 0);
    await ctx.db.patch(summaryId, { gotMeRating: rating, points });
    await ctx.scheduler.runAfter(0, internal.memory.remember, { summaryId });

    const author = await ctx.db.get(s.authorId);
    if (author) {
      const score = Math.max(0, Math.min(100, author.goodFaithScore + (rating - 3) * 2));
      await ctx.db.patch(s.authorId, { goodFaithScore: score });
    }

    // Conversation is done once both summaries are rated
    const conversationId = s.conversationId;
    if (!conversationId) return;
    const all = await ctx.db
      .query("summaries")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .collect();
    if (all.length === 2 && all.every((x) => x._id === summaryId || x.gotMeRating)) {
      await ctx.db.patch(conversationId, { status: "done" });
    }
  },
});

// Spectators guess too
export const spectatorVote = mutation({
  args: {
    summaryId: v.id("summaries"),
    userId: v.id("users"),
    pick: v.union(v.literal("first"), v.literal("second")),
  },
  handler: async (ctx, { summaryId, userId, pick }) => {
    const s = await ctx.db.get(summaryId);
    if (!s) throw new Error("Not found");
    if (userId === s.authorId || userId === s.aboutUserId) throw new Error("Participants can't vote here");
    const votes = await ctx.db
      .query("summaryVotes")
      .withIndex("by_summary", (q) => q.eq("summaryId", summaryId))
      .collect();
    if (votes.some((x) => x.userId === userId)) return;
    await ctx.db.insert("summaryVotes", { summaryId, userId, guess: pick });
  },
});

// Live tally for the big screen: "62% of the room thought the first one was human"
export const voteResults = query({
  args: { summaryId: v.id("summaries") },
  handler: async (ctx, { summaryId }) => {
    const votes = await ctx.db
      .query("summaryVotes")
      .withIndex("by_summary", (q) => q.eq("summaryId", summaryId))
      .collect();
    const first = votes.filter((x) => x.guess === "first").length;
    return { first, second: votes.length - first, total: votes.length };
  },
});

// ---------- Used by the AI actions ----------

export const contextFor = internalQuery({
  args: { summaryId: v.id("summaries") },
  handler: async (ctx, { summaryId }) => {
    const s = await ctx.db.get(summaryId);
    if (!s || !s.conversationId) return null;
    const conversationId = s.conversationId;
    const c = await ctx.db.get(conversationId);
    if (!c) return null;
    const [topic, about] = await Promise.all([ctx.db.get(c.topicId), ctx.db.get(s.aboutUserId)]);
    const msgs = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .collect();
    return {
      humanText: s.humanText,
      aboutName: about?.name ?? "them",
      question: topic?.question ?? "",
      theirMessages: msgs.filter((m) => m.userId === s.aboutUserId).map((m) => m.text),
    };
  },
});

export const setAiText = internalMutation({
  args: { summaryId: v.id("summaries"), aiText: v.string() },
  handler: async (ctx, { summaryId, aiText }) => {
    await ctx.db.patch(summaryId, { aiText });
  },
});
