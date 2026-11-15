// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    goodFaithScore: v.number(), // 0-100, starts at 50
    streak: v.number(),
    lastActiveDate: v.optional(v.string()), // "YYYY-MM-DD" in the user's local time
    insight: v.optional(v.string()), // personal insight from Supermemory, shown on Results
  }),

  topics: defineTable({
    date: v.string(),
    category: v.string(), // "politics" | "tech" | "culture"
    question: v.string(),
    sideA: v.string(),
    sideB: v.string(),
    brief: v.string(),
    sideAView: v.string(),
    sideBView: v.string(),
    sources: v.array(v.string()),
    status: v.string(), // "live" | "replaced" | "hidden"
  }).index("by_date_status", ["date", "status"]),

  // Where each user stands on a topic: 0 = fully sideA, 100 = fully sideB
  stances: defineTable({
    userId: v.id("users"),
    topicId: v.id("topics"),
    position: v.number(),
  })
    .index("by_topic", ["topicId"])
    .index("by_user_topic", ["userId", "topicId"]),

  // People waiting to be matched
  queue: defineTable({
    userId: v.id("users"),
    topicId: v.id("topics"),
    position: v.number(),
    allowSpectators: v.boolean(),
  })
    .index("by_topic", ["topicId"])
    .index("by_user", ["userId"]),

  conversations: defineTable({
    topicId: v.id("topics"),
    userA: v.id("users"),
    userB: v.id("users"),
    positionA: v.number(),
    positionB: v.number(),
    opener: v.optional(v.string()), // AI-written first question
    status: v.string(), // "live" | "summarizing" | "done"
    endsAt: v.number(), // timestamp, for the 5-minute timer
    allowSpectators: v.boolean(),
    civilityA: v.optional(v.number()), // 1-5, AI-rated
    civilityB: v.optional(v.number()),
  })
    .index("by_topic_status", ["topicId", "status"])
    .index("by_userA", ["userA"])
    .index("by_userB", ["userB"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    text: v.string(),
  }).index("by_conversation", ["conversationId"]),

  // Spectator reactions on messages
  reactions: defineTable({
    conversationId: v.id("conversations"),
    messageId: v.id("messages"),
    userId: v.id("users"),
    emoji: v.string(),
  }).index("by_conversation", ["conversationId"]),

  // "Here's what I heard": one per person per conversation
  summaries: defineTable({
    conversationId: v.id("conversations"),
    authorId: v.id("users"),
    aboutUserId: v.id("users"),
    humanText: v.string(),
    aiText: v.optional(v.string()),
    humanIsFirst: v.boolean(), // random order so the subject can't tell by position
    subjectGuess: v.optional(v.string()), // "first" | "second": which one they think is human
    gotMeRating: v.optional(v.number()), // 1-5: "Did they get you?"
    points: v.optional(v.number()),
  }).index("by_conversation", ["conversationId"]),

  // Spectators guessing which summary is human
  summaryVotes: defineTable({
    summaryId: v.id("summaries"),
    userId: v.id("users"),
    guess: v.string(),
  }).index("by_summary", ["summaryId"]),
});
