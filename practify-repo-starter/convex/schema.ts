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
    phone: v.optional(v.string()), // E.164, only for notifyVia "text"; never shown to other users
    interests: v.optional(v.array(v.string())), // "tech" | "politics" | "culture" | "sports" | "campus"
    notifyVia: v.optional(v.union(v.literal("app"), v.literal("text"))),
    totalPoints: v.optional(v.number()), // leaderboard total; missing = 0
  }).index("by_phone", ["phone"]),

  topics: defineTable({
    date: v.string(),
    category: v.string(), // "politics" | "tech" | "culture" | "sports" | "campus"
    question: v.string(),
    sideA: v.string(),
    sideB: v.string(),
    brief: v.string(),
    sideAView: v.string(),
    sideBView: v.string(),
    sources: v.array(v.string()),
    status: v.string(), // "live" | "replaced" | "hidden"
    isShared: v.optional(v.boolean()), // exactly one topic per day is the shared topic
  }).index("by_date_status", ["date", "status"]),

  // Where each user stands on a topic: 0 = fully sideA, 100 = fully sideB
  stances: defineTable({
    userId: v.id("users"),
    topicId: v.id("topics"),
    position: v.number(),
    take: v.optional(v.string()), // the user's own words, when given by text
    source: v.optional(v.union(v.literal("app"), v.literal("text"))),
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

  // Group rooms: up to 6 people per topic per slot
  rooms: defineTable({
    topicId: v.id("topics"),
    slot: v.number(), // timestamp the room is scheduled to start
    status: v.union(
      v.literal("open"), // taking members before the slot
      v.literal("live"),
      v.literal("rolled"), // didn't start; members moved to the next slot
      v.literal("summarizing"),
      v.literal("done"),
    ),
    endsAt: v.optional(v.number()), // set when the room goes live
    opener: v.optional(v.string()), // judge's first message
    agreement: v.optional(v.string()), // judge's closing line on where the group agreed
  })
    .index("by_topic_slot", ["topicId", "slot"])
    .index("by_status_slot", ["status", "slot"]),

  roomMembers: defineTable({
    roomId: v.id("rooms"),
    userId: v.id("users"),
    position: v.number(), // stance at join time, 0-100
    band: v.union(v.literal("A"), v.literal("M"), v.literal("B")), // A 0-35, M 36-64, B 65-100
    allowWatchers: v.boolean(),
    summarizesUserId: v.optional(v.id("users")), // next person in the circle
    leftAt: v.optional(v.number()),
  })
    .index("by_room", ["roomId"])
    .index("by_user", ["userId"])
    .index("by_room_user", ["roomId", "userId"]),

  roomMessages: defineTable({
    roomId: v.id("rooms"),
    userId: v.optional(v.id("users")), // missing = the AI judge
    isJudge: v.boolean(),
    text: v.string(),
    flagged: v.optional(v.boolean()), // personal-attack check flagged this message
  }).index("by_room", ["roomId"]),

  // In-app inbox (users with notifyVia "app")
  notifications: defineTable({
    userId: v.id("users"),
    message: v.string(),
    link: v.optional(v.string()),
    read: v.boolean(),
  }).index("by_user", ["userId"]),

  // practify://join/<code> links and code entry
  joinLinks: defineTable({
    code: v.string(), // 6 digits
    userId: v.id("users"),
    roomId: v.id("rooms"),
    redeemedAt: v.optional(v.number()),
  }).index("by_code", ["code"]),

  // "Here's what I heard": one per person per conversation or room
  summaries: defineTable({
    conversationId: v.optional(v.id("conversations")), // old 1-on-1 flow
    roomId: v.optional(v.id("rooms")), // group rooms
    authorId: v.id("users"),
    aboutUserId: v.id("users"),
    humanText: v.string(),
    aiText: v.optional(v.string()),
    humanIsFirst: v.boolean(), // random order so the subject can't tell by position
    subjectGuess: v.optional(v.string()), // "first" | "second": which one they think is human
    gotMeRating: v.optional(v.number()), // 1-5: "Did they get you?"
    points: v.optional(v.number()),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_room", ["roomId"]),

  // Spectators guessing which summary is human
  summaryVotes: defineTable({
    summaryId: v.id("summaries"),
    userId: v.id("users"),
    guess: v.string(),
  }).index("by_summary", ["summaryId"]),
});
