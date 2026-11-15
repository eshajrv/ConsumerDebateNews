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
    phone: v.optional(v.string()), // E.164, only for text users; never shown to others
    interests: v.optional(v.array(v.string())), // "tech" | "politics" | "culture" | "sports" | "campus"
    notifyVia: v.optional(v.union(v.literal("app"), v.literal("text"))),
    totalPoints: v.optional(v.number()),
  })
    .index("by_phone", ["phone"])
    .index("by_totalPoints", ["totalPoints"]),

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
    isShared: v.optional(v.boolean()), // exactly one shared topic per day
  }).index("by_date_status", ["date", "status"]),

  // Where each user stands on a topic: 0 = fully sideA, 100 = fully sideB
  stances: defineTable({
    userId: v.id("users"),
    topicId: v.id("topics"),
    position: v.number(),
    take: v.optional(v.string()), // the user's own words, if they gave them
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

  // "Here's what I heard": one per person per conversation
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

  // A user's ranked feed for one day, saved by feed.rank (non-shared topics, best first)
  feedOrders: defineTable({
    userId: v.id("users"),
    date: v.string(), // "YYYY-MM-DD" Pacific
    topicIds: v.array(v.id("topics")),
  }).index("by_user_and_date", ["userId", "date"]),

  // ---------- Group rooms ----------

  // One room per topic per slot (more if the first fills up)
  rooms: defineTable({
    topicId: v.id("topics"),
    slotStart: v.number(), // timestamp the room is scheduled to start
    status: v.union(
      v.literal("waiting"),
      v.literal("live"),
      v.literal("summarizing"),
      v.literal("done"),
      v.literal("rolled"),
    ),
    endsAt: v.optional(v.number()), // set when live: start + 10 min
    agreementLine: v.optional(v.string()), // judge's closing line
    allowSpectators: v.optional(v.boolean()),
  })
    .index("by_topic_and_slotStart", ["topicId", "slotStart"])
    .index("by_status_and_slotStart", ["status", "slotStart"]),

  roomMembers: defineTable({
    roomId: v.id("rooms"),
    userId: v.id("users"),
    position: v.number(), // stance at join time, 0-100
    band: v.union(v.literal("A"), v.literal("M"), v.literal("B")),
    allowSpectators: v.boolean(),
    circleOrder: v.optional(v.number()), // set when summarizing starts
    summarizesUserId: v.optional(v.id("users")),
    civility: v.optional(v.number()), // 1-5, AI-rated at the end
    left: v.optional(v.boolean()),
  })
    .index("by_room", ["roomId"])
    .index("by_user", ["userId"])
    .index("by_room_and_user", ["roomId", "userId"]),

  roomMessages: defineTable({
    roomId: v.id("rooms"),
    userId: v.optional(v.id("users")), // missing = the AI judge
    text: v.string(),
    kind: v.union(
      v.literal("user"),
      v.literal("opener"),
      v.literal("nudge"),
      v.literal("flag"),
      v.literal("closing"),
    ),
    flagged: v.optional(v.boolean()), // personal-attack check
  }).index("by_room", ["roomId"]),

  // Leaderboard: summary points per user per Pacific day (updated in summaries.rate)
  dailyPoints: defineTable({
    userId: v.id("users"),
    date: v.string(), // "YYYY-MM-DD" Pacific
    points: v.number(),
  })
    .index("by_date_and_points", ["date", "points"])
    .index("by_user_and_date", ["userId", "date"]),

  notifications: defineTable({
    userId: v.id("users"),
    message: v.string(),
    link: v.optional(v.string()),
    read: v.boolean(),
  }).index("by_user_and_read", ["userId", "read"]),

  // 6-digit codes behind practify://join/<code> links
  joinLinks: defineTable({
    code: v.string(),
    userId: v.id("users"),
    roomId: v.id("rooms"),
    used: v.optional(v.boolean()),
  }).index("by_code", ["code"]),
});
