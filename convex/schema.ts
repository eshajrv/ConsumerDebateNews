import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    phone: v.optional(v.string()),
    points: v.number(),
    goodFaith: v.number(),
    streak: v.number(),
    lastActiveDay: v.optional(v.string()),
  }).index("by_phone", ["phone"]),

  topics: defineTable({
    day: v.string(),
    category: v.string(),
    question: v.string(),
    sideA: v.string(),
    sideB: v.string(),
    brief: v.string(),
    sideAView: v.string(),
    sideBView: v.string(),
    sources: v.array(v.string()),
    hidden: v.boolean(),
  }).index("by_day", ["day"]),

  stances: defineTable({
    userId: v.id("users"),
    topicId: v.id("topics"),
    position: v.number(),
    take: v.optional(v.string()),
  })
    .index("by_topic", ["topicId"])
    .index("by_user_topic", ["userId", "topicId"]),

  pool: defineTable({
    userId: v.id("users"),
    topicId: v.id("topics"),
    position: v.number(),
    joinedAt: v.number(),
    source: v.union(v.literal("app"), v.literal("text")),
  })
    .index("by_topic", ["topicId"])
    .index("by_user", ["userId"]),

  conversations: defineTable({
    topicId: v.id("topics"),
    userA: v.id("users"),
    userB: v.id("users"),
    status: v.union(v.literal("waiting"), v.literal("live"), v.literal("ended")),
    opener: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    endsAt: v.optional(v.number()),
    joinedA: v.boolean(),
    joinedB: v.boolean(),
  })
    .index("by_topic", ["topicId"])
    .index("by_userA", ["userA"])
    .index("by_userB", ["userB"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    text: v.string(),
    createdAt: v.number(),
  }).index("by_conversation", ["conversationId", "createdAt"]),

  summaries: defineTable({
    conversationId: v.id("conversations"),
    authorId: v.id("users"),
    aboutUserId: v.id("users"),
    text: v.string(),
    aiText: v.optional(v.string()),
    guessCorrect: v.optional(v.boolean()),
    rating: v.optional(v.number()),
  }).index("by_conversation", ["conversationId"]),

  joinCodes: defineTable({
    code: v.string(),
    userId: v.id("users"),
    conversationId: v.id("conversations"),
    used: v.boolean(),
  }).index("by_code", ["code"]),
});
