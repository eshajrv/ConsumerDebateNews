// convex/rooms.ts
// Group rooms: up to 6 people per topic per slot, mixed across the opinion scale,
// a 10-minute chat with an AI judge, then the "Here's what I heard" circle.
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  MutationCtx,
  QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { ConvexError, v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { askClaude, extractJson } from "./lib/claude";
import { notify } from "./notify";

const TZ = "America/Los_Angeles";
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const FIRST_SLOT = 7 * 60; // 7:00 AM Pacific, in minutes after midnight
const LAST_SLOT = 22 * 60; // 10:00 PM Pacific
const MAX_MEMBERS = 6;
const MIN_TO_START = 2;
const MIN_SPREAD = 40;
const ROOM_MS = 10 * MINUTE;
const NUDGE_MS = 4 * MINUTE;

const slotMinutes = () => {
  const n = Number(process.env.SLOT_MINUTES);
  return n > 0 ? n : 15;
};

const bandOf = (position: number): "A" | "M" | "B" => (position <= 35 ? "A" : position <= 64 ? "M" : "B");

const roomLink = (roomId: Id<"rooms">) => `practify://room/${roomId}`;

// Milliseconds to add to a UTC timestamp to get Pacific wall-clock time
function pacificOffset(ms: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ms));
  const p = Object.fromEntries(parts.map((x) => [x.type, Number(x.value)]));
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wall - Math.floor(ms / 1000) * 1000;
}

function fromPacificWall(wall: number): number {
  const guess = wall - pacificOffset(wall);
  return wall - pacificOffset(guess);
}

// The first slot start strictly after `now`
export function nextSlot(now: number): number {
  const slot = slotMinutes();
  const wall = now + pacificOffset(now);
  const dayStart = Math.floor(wall / DAY) * DAY;
  const mins = (wall - dayStart) / MINUTE;
  let m = mins < FIRST_SLOT ? FIRST_SLOT : FIRST_SLOT + (Math.floor((mins - FIRST_SLOT) / slot) + 1) * slot;
  let day = dayStart;
  if (m > LAST_SLOT) {
    m = FIRST_SLOT;
    day += DAY;
  }
  return fromPacificWall(day + m * MINUTE);
}

const formatTime = (ms: number) =>
  new Date(ms).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });

async function activeMembers(ctx: QueryCtx, roomId: Id<"rooms">) {
  const members = await ctx.db
    .query("roomMembers")
    .withIndex("by_room", (q) => q.eq("roomId", roomId))
    .collect();
  return members.filter((m) => !m.left);
}

// Puts a user in the waiting room for `slotStart` with the fewest people from their band,
// opening (and scheduling) a new room when every room is full.
async function placeInRoom(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    topicId: Id<"topics">;
    position: number;
    allowSpectators: boolean;
    slotStart: number;
  },
): Promise<Id<"rooms">> {
  const band = bandOf(args.position);
  const rooms = await ctx.db
    .query("rooms")
    .withIndex("by_topic_and_slotStart", (q) => q.eq("topicId", args.topicId).eq("slotStart", args.slotStart))
    .collect();

  let best: { room: Doc<"rooms">; sameBand: number; total: number } | null = null;
  for (const room of rooms) {
    if (room.status !== "waiting") continue;
    const members = await activeMembers(ctx, room._id);
    if (members.length >= MAX_MEMBERS) continue;
    const sameBand = members.filter((m) => m.band === band).length;
    if (!best || sameBand < best.sameBand || (sameBand === best.sameBand && members.length < best.total)) {
      best = { room, sameBand, total: members.length };
    }
  }

  let roomId: Id<"rooms">;
  if (best) {
    roomId = best.room._id;
    if (!args.allowSpectators) await ctx.db.patch(roomId, { allowSpectators: false });
  } else {
    roomId = await ctx.db.insert("rooms", {
      topicId: args.topicId,
      slotStart: args.slotStart,
      status: "waiting",
      allowSpectators: args.allowSpectators,
    });
    await ctx.scheduler.runAt(args.slotStart, internal.rooms.checkStart, { roomId });
    if (args.slotStart - MINUTE > Date.now()) {
      await ctx.scheduler.runAt(args.slotStart - MINUTE, internal.rooms.remind, { roomId });
    }
  }

  await ctx.db.insert("roomMembers", {
    roomId,
    userId: args.userId,
    position: args.position,
    band,
    allowSpectators: args.allowSpectators,
  });
  return roomId;
}

// ---------- Public API ----------

// "Next room 8:15, 4 joined". `now` comes from the phone (queries can't read the clock).
export const next = query({
  args: { topicId: v.id("topics"), now: v.number() },
  handler: async (ctx, { topicId, now }) => {
    const slot = nextSlot(now);
    const rooms = await ctx.db
      .query("rooms")
      .withIndex("by_topic_and_slotStart", (q) => q.eq("topicId", topicId).eq("slotStart", slot))
      .collect();
    let joinedCount = 0;
    for (const room of rooms) {
      if (room.status === "waiting") joinedCount += (await activeMembers(ctx, room._id)).length;
    }
    return { slot, joinedCount };
  },
});

// Shared by rooms.join and the Keiki join endpoint
export async function joinRoom(
  ctx: MutationCtx,
  { userId, topicId, allowSpectators }: { userId: Id<"users">; topicId: Id<"topics">; allowSpectators?: boolean },
): Promise<Id<"rooms">> {
  const stance = await ctx.db
    .query("stances")
    .withIndex("by_user_topic", (q) => q.eq("userId", userId).eq("topicId", topicId))
    .unique();
  if (!stance) throw new ConvexError("Set where you stand first");

  // Already waiting (or chatting) in a room on this topic? Return it.
  const memberships = await ctx.db
    .query("roomMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  for (const m of memberships) {
    if (m.left) continue;
    const room = await ctx.db.get(m.roomId);
    if (room && room.topicId === topicId && (room.status === "waiting" || room.status === "live")) {
      return room._id;
    }
  }

  return placeInRoom(ctx, {
    userId,
    topicId,
    position: stance.position,
    allowSpectators: allowSpectators ?? true,
    slotStart: nextSlot(Date.now()),
  });
}

export const join = mutation({
  args: { userId: v.id("users"), topicId: v.id("topics"), allowSpectators: v.optional(v.boolean()) },
  handler: async (ctx, args) => joinRoom(ctx, args),
});

export const get = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const room = await ctx.db.get(roomId);
    if (!room) return null;
    const [topic, members] = await Promise.all([ctx.db.get(room.topicId), activeMembers(ctx, roomId)]);
    return {
      ...room,
      topic,
      members: await Promise.all(
        members.map(async (m) => ({
          userId: m.userId,
          name: (await ctx.db.get(m.userId))?.name ?? "",
          position: m.position,
          band: m.band,
          circleOrder: m.circleOrder,
          summarizesUserId: m.summarizesUserId,
          movedToRoomId: m.movedToRoomId,
        })),
      ),
    };
  },
});

export const messages = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) =>
    ctx.db
      .query("roomMessages")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect(),
});

export const send = mutation({
  args: { roomId: v.id("rooms"), userId: v.id("users"), text: v.string() },
  handler: async (ctx, { roomId, userId, text }) => {
    const room = await ctx.db.get(roomId);
    if (!room || room.status !== "live") throw new ConvexError("This room isn't live right now.");
    const member = await ctx.db
      .query("roomMembers")
      .withIndex("by_room_and_user", (q) => q.eq("roomId", roomId).eq("userId", userId))
      .unique();
    if (!member || member.left) throw new ConvexError("Only people in this room can send messages.");
    const clean = text.trim().slice(0, 500);
    if (!clean) return;
    const messageId = await ctx.db.insert("roomMessages", { roomId, userId, text: clean, kind: "user" });
    await ctx.scheduler.runAfter(0, internal.rooms.checkAttack, { messageId });
  },
});

// "Watch live": live rooms where every member allowed spectators
export const live = query({
  args: { topicId: v.optional(v.id("topics")) },
  handler: async (ctx, { topicId }) => {
    const rooms = await ctx.db
      .query("rooms")
      .withIndex("by_status_and_slotStart", (q) => q.eq("status", "live"))
      .collect();
    const result = [];
    for (const room of rooms) {
      if (topicId && room.topicId !== topicId) continue;
      const members = await activeMembers(ctx, room._id);
      if (members.length === 0 || !members.every((m) => m.allowSpectators)) continue;
      const topic = await ctx.db.get(room.topicId);
      result.push({
        _id: room._id,
        topicId: room.topicId,
        question: topic?.question ?? "",
        endsAt: room.endsAt,
        members: await Promise.all(
          members.map(async (m) => ({
            name: (await ctx.db.get(m.userId))?.name ?? "",
            position: m.position,
            band: m.band,
          })),
        ),
      });
    }
    return result;
  },
});

// ---------- Scheduled ----------

export const remind = internalMutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const room = await ctx.db.get(roomId);
    if (!room || room.status !== "waiting") return;
    for (const m of await activeMembers(ctx, roomId)) {
      await notify(ctx, m.userId, "Your room starts in 1 minute", roomLink(roomId));
    }
  },
});

export const checkStart = internalMutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const room = await ctx.db.get(roomId);
    if (!room || room.status !== "waiting") return;
    const members = await activeMembers(ctx, roomId);
    const positions = members.map((m) => m.position);
    const spread = positions.length ? Math.max(...positions) - Math.min(...positions) : 0;

    if (members.length >= MIN_TO_START && spread >= MIN_SPREAD) {
      const endsAt = Date.now() + ROOM_MS;
      await ctx.db.patch(roomId, { status: "live", endsAt });
      await ctx.scheduler.runAfter(0, internal.rooms.writeOpener, { roomId });
      await ctx.scheduler.runAfter(NUDGE_MS, internal.rooms.nudge, { roomId });
      await ctx.scheduler.runAt(endsAt, internal.rooms.end, { roomId });
      return;
    }

    const slotStart = nextSlot(Math.max(Date.now(), room.slotStart));
    const movedCount = new Map<Id<"rooms">, number>();
    for (const m of members) {
      const newRoomId = await placeInRoom(ctx, {
        userId: m.userId,
        topicId: room.topicId,
        position: m.position,
        allowSpectators: m.allowSpectators,
        slotStart,
      });
      movedCount.set(newRoomId, (movedCount.get(newRoomId) ?? 0) + 1);
      await ctx.db.patch(m._id, { movedToRoomId: newRoomId });
      await notify(ctx, m.userId, `We moved you to ${formatTime(slotStart)}`, roomLink(newRoomId));
    }
    const movedToRoomId = [...movedCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    await ctx.db.patch(roomId, { status: "rolled", movedToRoomId });
  },
});

export const context = internalQuery({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const room = await ctx.db.get(roomId);
    if (!room) return null;
    const topic = await ctx.db.get(room.topicId);
    if (!topic) return null;
    const members = await Promise.all(
      (await activeMembers(ctx, roomId)).map(async (m) => ({
        userId: m.userId,
        name: (await ctx.db.get(m.userId))?.name ?? "Someone",
        position: m.position,
      })),
    );
    const msgs = await ctx.db
      .query("roomMessages")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
    const nameOf = (id?: Id<"users">) => members.find((m) => m.userId === id)?.name ?? "Someone";
    return {
      status: room.status,
      topic,
      members,
      lines: msgs.filter((m) => m.kind === "user").map((m) => `${nameOf(m.userId)}: ${m.text}`),
    };
  },
});

export const addJudgeMessage = internalMutation({
  args: {
    roomId: v.id("rooms"),
    kind: v.union(v.literal("opener"), v.literal("nudge"), v.literal("closing")),
    text: v.string(),
  },
  handler: async (ctx, { roomId, kind, text }) => {
    const room = await ctx.db.get(roomId);
    if (!room) return;
    if (kind === "closing") {
      await ctx.db.patch(roomId, { agreementLine: text });
    } else if (room.status !== "live") {
      return;
    }
    await ctx.db.insert("roomMessages", { roomId, kind, text });
  },
});

const describe = (position: number, sideA: string, sideB: string) => {
  if (position <= 20) return `strongly "${sideA}"`;
  if (position < 45) return `leaning "${sideA}"`;
  if (position <= 55) return "in the middle";
  if (position < 80) return `leaning "${sideB}"`;
  return `strongly "${sideB}"`;
};

export const writeOpener = internalAction({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const c = await ctx.runQuery(internal.rooms.context, { roomId });
    if (!c || c.members.length === 0) return;
    const t = c.topic;
    const furthest = c.members.reduce((a, b) => (Math.abs(b.position - 50) > Math.abs(a.position - 50) ? b : a));
    const fallback = `You're all here because you care about this question. ${furthest.name}, what's the main thing that shapes how you see it?`;
    let text = fallback;
    try {
      const prompt = `You are the neutral host of a short group conversation about this question:
"${t.question}"

The people in the room:
${c.members.map((m) => `- ${m.name}: ${describe(m.position, t.sideA, t.sideB)}`).join("\n")}

Write an opener of at most 2 short sentences:
1. Name one thing everyone in the room probably agrees on or cares about.
2. Ask ${furthest.name} (by first name) a curious, open question about why they see it the way they do.
Warm and casual. Never take a side or say what you think. Return only the opener text.`;
      text = (await askClaude(prompt, 200)).trim() || fallback;
    } catch (e) {
      console.log("Room opener failed; using fallback", e);
    }
    await ctx.runMutation(internal.rooms.addJudgeMessage, { roomId, kind: "opener", text });
  },
});

// Minute 4: invite anyone who hasn't said anything yet
export const nudge = internalMutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const room = await ctx.db.get(roomId);
    if (!room || room.status !== "live") return;
    const msgs = await ctx.db
      .query("roomMessages")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
    const spoke = new Set(msgs.map((m) => m.userId));
    const quiet = (await activeMembers(ctx, roomId)).filter((m) => !spoke.has(m.userId));
    if (quiet.length === 0) return;
    const names = await Promise.all(quiet.map(async (m) => (await ctx.db.get(m.userId))?.name ?? "friend"));
    const who = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
    await ctx.db.insert("roomMessages", {
      roomId,
      kind: "nudge",
      text: `${who}, we'd love to hear from you too. What's one thing you think the group might be missing?`,
    });
  },
});

export const checkAttack = internalAction({
  args: { messageId: v.id("roomMessages") },
  handler: async (ctx, { messageId }) => {
    const text = await ctx.runQuery(internal.rooms.messageText, { messageId });
    if (!text) return;
    let attack = false;
    try {
      const prompt = `Is this chat message a personal attack (insulting, mocking or demeaning a person rather than disagreeing with an idea)?
Strong disagreement is fine and is NOT an attack.

Message: "${text}"

Return ONLY JSON: {"attack": true} or {"attack": false}`;
      attack = extractJson<{ attack: boolean }>(await askClaude(prompt, 20)).attack === true;
    } catch (e) {
      console.log("Attack check failed; not flagging", e);
    }
    if (attack) await ctx.runMutation(internal.rooms.flagMessage, { messageId });
  },
});

export const messageText = internalQuery({
  args: { messageId: v.id("roomMessages") },
  handler: async (ctx, { messageId }) => (await ctx.db.get(messageId))?.text ?? null,
});

export const flagMessage = internalMutation({
  args: { messageId: v.id("roomMessages") },
  handler: async (ctx, { messageId }) => {
    const msg = await ctx.db.get(messageId);
    if (!msg || msg.flagged || !msg.userId) return;
    await ctx.db.patch(messageId, { flagged: true });
    await ctx.db.insert("roomMessages", {
      roomId: msg.roomId,
      kind: "flag",
      text: "Let's keep it about the ideas, not the person. Try asking what's behind their view instead.",
    });
    const user = await ctx.db.get(msg.userId);
    if (user) await ctx.db.patch(user._id, { goodFaithScore: Math.max(0, user.goodFaithScore - 2) });
  },
});

// Time's up: build the summary circle and have the judge close
export const end = internalMutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const room = await ctx.db.get(roomId);
    if (!room || room.status !== "live") return;
    await ctx.db.patch(roomId, { status: "summarizing" });
    const circle = await activeMembers(ctx, roomId);
    for (let i = circle.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [circle[i], circle[j]] = [circle[j], circle[i]];
    }
    for (let i = 0; i < circle.length; i++) {
      await ctx.db.patch(circle[i]._id, {
        circleOrder: i,
        summarizesUserId: circle[(i + 1) % circle.length].userId,
      });
    }
    await ctx.scheduler.runAfter(0, internal.rooms.writeClosing, { roomId });
    await ctx.scheduler.runAfter(0, internal.ai.rateRoomCivility, { roomId });
  },
});

export const writeClosing = internalAction({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const c = await ctx.runQuery(internal.rooms.context, { roomId });
    if (!c) return;
    const fallback = "Time's up. Thanks, everyone: you all took the question seriously and heard each other out.";
    let text = fallback;
    if (c.lines.length > 0) {
      try {
        const prompt = `A group just discussed: "${c.topic.question}"

${c.lines.join("\n")}

In ONE short sentence, say where the group found common ground. Never take a side or say who was right.
Return only the sentence.`;
        text = (await askClaude(prompt, 120)).trim() || fallback;
      } catch (e) {
        console.log("Room closing failed; using fallback", e);
      }
    }
    await ctx.runMutation(internal.rooms.addJudgeMessage, { roomId, kind: "closing", text });
  },
});

// Messages labeled by speaker number (no names), for the civility rating
export const civilityTranscript = internalQuery({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const msgs = await ctx.db
      .query("roomMessages")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
    const speakers: Id<"users">[] = [];
    const lines: string[] = [];
    for (const m of msgs) {
      if (m.kind !== "user" || !m.userId) continue;
      if (!speakers.includes(m.userId)) speakers.push(m.userId);
      lines.push(`${speakers.indexOf(m.userId) + 1}: ${m.text}`);
    }
    return { speakers, lines };
  },
});

// Saves each member's AI civility rating and nudges their good-faith score by (civility - 3) x 2
export const setCivility = internalMutation({
  args: {
    roomId: v.id("rooms"),
    ratings: v.array(v.object({ userId: v.id("users"), civility: v.number() })),
  },
  handler: async (ctx, { roomId, ratings }) => {
    for (const { userId, civility } of ratings) {
      const member = await ctx.db
        .query("roomMembers")
        .withIndex("by_room_and_user", (q) => q.eq("roomId", roomId).eq("userId", userId))
        .unique();
      if (!member || member.civility !== undefined) continue;
      await ctx.db.patch(member._id, { civility });
      const user = await ctx.db.get(userId);
      if (!user) continue;
      await ctx.db.patch(userId, {
        goodFaithScore: Math.max(0, Math.min(100, user.goodFaithScore + (civility - 3) * 2)),
      });
    }
  },
});

// ---------- Minds moved ----------

const MOVED = 10; // a shift of 10+ points counts as a changed mind

// After the chat, each member says where they stand now
export const setPositionAfter = mutation({
  args: { roomId: v.id("rooms"), userId: v.id("users"), position: v.number() },
  handler: async (ctx, { roomId, userId, position }) => {
    const room = await ctx.db.get(roomId);
    if (!room) throw new ConvexError("We couldn't find that room.");
    if (room.status !== "summarizing" && room.status !== "done") {
      throw new ConvexError("You can update where you stand once the chat ends.");
    }
    const member = await ctx.db
      .query("roomMembers")
      .withIndex("by_room_and_user", (q) => q.eq("roomId", roomId).eq("userId", userId))
      .unique();
    if (!member || member.left) throw new ConvexError("Only people in this room can do that.");
    if (!Number.isFinite(position)) throw new ConvexError("Pick a spot on the slider.");
    const after = Math.max(0, Math.min(100, Math.round(position)));
    await ctx.db.patch(member._id, { positionAfter: after });

    const [topic, user] = await Promise.all([ctx.db.get(room.topicId), ctx.db.get(userId)]);
    if (!topic || !user) return;
    await ctx.scheduler.runAfter(0, internal.memory.remember, {
      shift: {
        roomId,
        userId,
        name: user.name,
        date: topic.date,
        category: topic.category,
        question: topic.question,
        sideA: topic.sideA,
        sideB: topic.sideB,
        before: member.position,
        after,
      },
    });
  },
});

// Before vs after for everyone in the room. after/shift are null until a member answers.
export const mindsMoved = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const members = await Promise.all(
      (await activeMembers(ctx, roomId)).map(async (m) => ({
        userId: m.userId,
        name: (await ctx.db.get(m.userId))?.name ?? "",
        before: m.position,
        after: m.positionAfter ?? null,
        shift: m.positionAfter === undefined ? null : m.positionAfter - m.position,
      })),
    );
    const gap = (ps: number[]) => (ps.length ? Math.max(...ps) - Math.min(...ps) : 0);
    const answered = members.filter((m) => m.after !== null);
    return {
      members,
      movedCount: answered.filter((m) => Math.abs(m.shift!) >= MOVED).length,
      total: members.length,
      averageGapBefore: gap(members.map((m) => m.before)),
      averageGapAfter: gap(members.map((m) => m.after ?? m.before)),
    };
  },
});
