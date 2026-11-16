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
import { FunctionReturnType } from "convex/server";
import { Doc, Id } from "./_generated/dataModel";
import { askClaude, extractJson } from "./lib/claude";
import { notify } from "./notify";
import { topicImage } from "./lib/topicImages";

const TZ = "America/Los_Angeles";
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const FIRST_SLOT = 7 * 60; // 7:00 AM Pacific, in minutes after midnight
const LAST_SLOT = 22 * 60; // 10:00 PM Pacific
const MAX_MEMBERS = { duo: 2, group: 6 };
const MIN_TO_START = { duo: 2, group: 3 };
const STALE_MS = 15_000; // the lobby pings every 5s; a seat with no ping for this long is empty

type Mode = "duo" | "group";
export const modeValidator = v.union(v.literal("duo"), v.literal("group"));
const modeOf = (room: Doc<"rooms">): Mode => room.mode ?? "group";
const MIN_SPREAD = 30;
const ROOM_MS = 5 * MINUTE;
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

// Clears lobby seats whose phone stopped pinging (closed the app, went back without leaving)
async function pruneLobby(ctx: MutationCtx, roomId: Id<"rooms">) {
  const now = Date.now();
  for (const m of await activeMembers(ctx, roomId)) {
    if ((m.seenAt ?? 0) < now - STALE_MS) await ctx.db.patch(m._id, { left: true, leftAt: now, timedOut: true });
  }
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
    mode: Mode;
    excludeRoomId?: Id<"rooms">; // the table being rolled
  },
): Promise<Id<"rooms">> {
  const band = bandOf(args.position);
  // Any table on this topic still waiting (whatever its slot), so friends who join across a
  // slot boundary still end up together; a new table for args.slotStart only when none has space.
  const rooms = (
    await ctx.db
      .query("rooms")
      .withIndex("by_status_and_slotStart", (q) => q.eq("status", "waiting"))
      .collect()
  ).filter((r) => r.topicId === args.topicId && r._id !== args.excludeRoomId);

  // Rooms need a band-M member to start, so a band-M user first goes to a room with no M yet.
  // Otherwise: the room with the fewest people from the user's band, then the emptier room.
  let best: { room: Doc<"rooms">; needsMiddle: boolean; sameBand: number; total: number } | null = null;
  for (const room of rooms) {
    if (room.status !== "waiting" || modeOf(room) !== args.mode) continue;
    await pruneLobby(ctx, room._id);
    const members = await activeMembers(ctx, room._id);
    if (members.length >= MAX_MEMBERS[args.mode]) continue;
    const sameBand = members.filter((m) => m.band === band).length;
    const needsMiddle = band === "M" && !members.some((m) => m.band === "M");
    const better =
      !best ||
      (needsMiddle && !best.needsMiddle) ||
      (needsMiddle === best.needsMiddle &&
        (sameBand < best.sameBand || (sameBand === best.sameBand && members.length < best.total)));
    if (better) best = { room, needsMiddle, sameBand, total: members.length };
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
      mode: args.mode,
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
    seenAt: Date.now(),
  });
  // Open the table as soon as the right people are seated, instead of waiting for the slot
  await ctx.scheduler.runAfter(0, internal.rooms.checkStart, { roomId, early: true });
  return roomId;
}

// ---------- Public API ----------

// "Next room 8:15, 4 joined". `now` comes from the phone (queries can't read the clock).
export const next = query({
  args: { topicId: v.id("topics"), now: v.number(), mode: v.optional(modeValidator) },
  handler: async (ctx, { topicId, now, mode }) => {
    const slot = nextSlot(now);
    const rooms = await ctx.db
      .query("rooms")
      .withIndex("by_status_and_slotStart", (q) => q.eq("status", "waiting"))
      .collect();
    let joinedCount = 0;
    for (const room of rooms) {
      if (room.topicId === topicId && modeOf(room) === (mode ?? "group")) {
        joinedCount += (await activeMembers(ctx, room._id)).length;
      }
    }
    return { slot, joinedCount };
  },
});

// Shared by rooms.join and the Keiki join endpoint
export async function joinRoom(
  ctx: MutationCtx,
  {
    userId,
    topicId,
    allowSpectators,
    mode,
  }: { userId: Id<"users">; topicId: Id<"topics">; allowSpectators?: boolean; mode?: Mode },
): Promise<Id<"rooms">> {
  const stance = await ctx.db
    .query("stances")
    .withIndex("by_user_topic", (q) => q.eq("userId", userId).eq("topicId", topicId))
    .unique();
  if (!stance) throw new ConvexError("Set where you stand first");

  // Already chatting on this topic? Return that room. Still waiting? Give up that seat and
  // sit down again, so a new mode or a changed stance takes effect.
  const memberships = await ctx.db
    .query("roomMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  for (const m of memberships) {
    if (m.left) continue;
    const room = await ctx.db.get(m.roomId);
    if (!room || room.topicId !== topicId) continue;
    if (room.status === "live") return room._id;
    if (room.status === "waiting") await ctx.db.patch(m._id, { left: true, leftAt: Date.now() });
  }

  return placeInRoom(ctx, {
    userId,
    topicId,
    position: stance.position,
    allowSpectators: allowSpectators ?? true,
    slotStart: nextSlot(Date.now()),
    mode: mode ?? "group",
  });
}

export const join = mutation({
  args: {
    userId: v.id("users"),
    topicId: v.id("topics"),
    allowSpectators: v.optional(v.boolean()),
    mode: v.optional(modeValidator),
  },
  handler: async (ctx, args) => joinRoom(ctx, args),
});

// People watching a live room ("at the bar"). Each watcher's screen sends a heartbeat;
// stale rows are cleared on each heartbeat.
const WATCHER_TTL = 45_000;

export const watchBeat = mutation({
  args: { roomId: v.id("rooms"), viewerKey: v.string() },
  handler: async (ctx, { roomId, viewerKey }) => {
    const now = Date.now();
    const rows = await ctx.db
      .query("roomWatchers")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .take(200);
    let mine = false;
    for (const r of rows) {
      if (r.viewerKey === viewerKey) {
        await ctx.db.patch(r._id, { lastSeen: now });
        mine = true;
      } else if (now - r.lastSeen > WATCHER_TTL) {
        await ctx.db.delete(r._id);
      }
    }
    if (!mine) await ctx.db.insert("roomWatchers", { roomId, viewerKey: viewerKey.slice(0, 64), lastSeen: now });
  },
});

export const stopWatching = mutation({
  args: { roomId: v.id("rooms"), viewerKey: v.string() },
  handler: async (ctx, { roomId, viewerKey }) => {
    const rows = await ctx.db
      .query("roomWatchers")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .take(200);
    for (const r of rows) if (r.viewerKey === viewerKey) await ctx.db.delete(r._id);
  },
});

export const get = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const room = await ctx.db.get(roomId);
    if (!room) return null;
    const watchers = await ctx.db
      .query("roomWatchers")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .take(200);
    const [topicDoc, members] = await Promise.all([
      ctx.db.get(room.topicId),
      ctx.db
        .query("roomMembers")
        .withIndex("by_room", (q) => q.eq("roomId", roomId))
        .collect(),
    ]);
    const active = members.filter((m) => !m.left);
    const topic = topicDoc ? { ...topicDoc, imageUrl: topicImage(topicDoc) } : null;
    return {
      ...room,
      topic,
      watcherCount: watchers.length,
      endVotes: active.filter((m) => m.wantsToEnd).length,
      activeCount: active.length,
      members: await Promise.all(
        members.map(async (m) => ({
          userId: m.userId,
          name: (await ctx.db.get(m.userId))?.name ?? "",
          position: m.position,
          band: m.band,
          circleOrder: m.circleOrder,
          summarizesUserId: m.summarizesUserId,
          movedToRoomId: m.movedToRoomId,
          leftAt: m.leftAt ?? null,
          wantsToEnd: m.wantsToEnd ?? false,
          typingUntil: m.typingUntil ?? null,
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
    if (member.typingUntil !== undefined) await ctx.db.patch(member._id, { typingUntil: undefined });
    await ctx.scheduler.runAfter(0, internal.rooms.checkAttack, { messageId });
  },
});

const TYPING_MS = 4000;

// Typing indicator: "<name> is typing…" until typingUntil (the app compares it to the phone's clock).
// Skips the write if the current indicator still has 2+ seconds left, so calling on every keystroke is cheap.
export const setTyping = mutation({
  args: { roomId: v.id("rooms"), userId: v.id("users") },
  handler: async (ctx, { roomId, userId }) => {
    const room = await ctx.db.get(roomId);
    if (!room || room.status !== "live") throw new ConvexError("This room isn't live right now.");
    const member = await ctx.db
      .query("roomMembers")
      .withIndex("by_room_and_user", (q) => q.eq("roomId", roomId).eq("userId", userId))
      .unique();
    if (!member || member.left) throw new ConvexError("You're not in this room.");
    const now = Date.now();
    if ((member.typingUntil ?? 0) - now > TYPING_MS / 2) return;
    await ctx.db.patch(member._id, { typingUntil: now + TYPING_MS });
  },
});

// "Watch live": live rooms where every member allowed spectators
// Live rooms where every member allowed spectators
async function watchableRooms(ctx: QueryCtx, topicId?: Id<"topics">) {
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
      category: topic?.category ?? "",
      imageUrl: topic ? topicImage(topic) : undefined,
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
}

export const live = query({
  args: { topicId: v.optional(v.id("topics")) },
  handler: async (ctx, { topicId }) => watchableRooms(ctx, topicId),
});

const FEATURED_WINDOW = 2 * MINUTE;
// When the judge checks whether views are moving, as fractions of the chat (3, 6 and 9 min of 10)
const SHIFT_CHECKS = [0.3, 0.6, 0.9];

// rooms.featured: the live, watchable room with the most messages in the last 2 minutes.
// Pass `now` from the client (queries don't read the clock); without it, the window ends at
// the newest message in any watchable room.
export const featured = query({
  args: { topicId: v.optional(v.id("topics")), now: v.optional(v.number()) },
  handler: async (ctx, { topicId, now }) => {
    const rooms = await watchableRooms(ctx, topicId);
    if (rooms.length === 0) return null;
    const recent = await Promise.all(
      rooms.map((r) =>
        ctx.db
          .query("roomMessages")
          .withIndex("by_room", (q) => q.eq("roomId", r._id))
          .order("desc")
          .take(200),
      ),
    );
    const windowEnd = now ?? Math.max(0, ...recent.flat().map((m) => m._creationTime));
    let best: { room: (typeof rooms)[number]; recentMessages: number } | null = null;
    rooms.forEach((room, i) => {
      const recentMessages = recent[i].filter(
        (m) => m.kind === "user" && m._creationTime >= windowEnd - FEATURED_WINDOW && m._creationTime <= windowEnd,
      ).length;
      if (!best || recentMessages > best.recentMessages) best = { room, recentMessages };
    });
    const pick = best as { room: (typeof rooms)[number]; recentMessages: number } | null;
    return pick ? { ...pick.room, recentMessages: pick.recentMessages } : null;
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

async function startRoom(ctx: MutationCtx, roomId: Id<"rooms">) {
  const endsAt = Date.now() + ROOM_MS;
  await ctx.db.patch(roomId, { status: "live", endsAt });
  await assignCircle(ctx, roomId); // shown in the chat as "Listen for <name>"
  await ctx.scheduler.runAfter(0, internal.rooms.writeOpener, { roomId });
  await ctx.scheduler.runAfter(NUDGE_MS, internal.rooms.nudge, { roomId });
  for (const at of SHIFT_CHECKS) {
    await ctx.scheduler.runAfter(Math.round(ROOM_MS * at), internal.rooms.trackShifts, { roomId });
  }
  await ctx.scheduler.runAt(endsAt, internal.rooms.end, { roomId });
}

// "Start now" in a group lobby: anyone seated can open the table once MIN_TO_START people are there
export const startNow = mutation({
  args: { roomId: v.id("rooms"), userId: v.id("users") },
  handler: async (ctx, { roomId, userId }) => {
    const room = await ctx.db.get(roomId);
    if (!room || room.status !== "waiting") return;
    await pruneLobby(ctx, roomId);
    const members = await activeMembers(ctx, roomId);
    if (!members.some((m) => m.userId === userId)) throw new ConvexError("You're not at this table.");
    if (members.length < MIN_TO_START[modeOf(room)]) {
      throw new ConvexError(`A table needs at least ${MIN_TO_START[modeOf(room)]} people to start.`);
    }
    await startRoom(ctx, roomId);
  },
});

export const checkStart = internalMutation({
  args: { roomId: v.id("rooms"), early: v.optional(v.boolean()) },
  handler: async (ctx, { roomId, early }) => {
    const room = await ctx.db.get(roomId);
    if (!room || room.status !== "waiting") return;
    await pruneLobby(ctx, roomId);
    const members = await activeMembers(ctx, roomId);
    const positions = members.map((m) => m.position);
    const spread = positions.length ? Math.max(...positions) - Math.min(...positions) : 0;
    const mode = modeOf(room);
    // Middle person rule (group rooms): someone in band M (36-64) keeps the room from
    // splitting into two camps. Duos are 1-on-1 and only need the spread.
    const hasMiddle = mode === "duo" || members.some((m) => m.band === "M");

    // Group lobbies wait for someone to tap "Start now" (rooms.startNow) unless the table fills up
    const waitForStartNow = early && mode === "group" && members.length < MAX_MEMBERS.group;
    if (!waitForStartNow && members.length >= MIN_TO_START[mode] && spread >= MIN_SPREAD && hasMiddle) {
      await startRoom(ctx, roomId);
      return;
    }
    // A seat-time check that isn't ready yet keeps waiting; only the slot-time check rolls the table
    if (early) return;

    const slotStart = nextSlot(Math.max(Date.now(), room.slotStart));
    const movedCount = new Map<Id<"rooms">, number>();
    for (const m of members) {
      const newRoomId = await placeInRoom(ctx, {
        userId: m.userId,
        topicId: room.topicId,
        position: m.position,
        allowSpectators: m.allowSpectators,
        slotStart,
        mode,
        excludeRoomId: roomId,
      });
      movedCount.set(newRoomId, (movedCount.get(newRoomId) ?? 0) + 1);
      await ctx.db.patch(m._id, { movedToRoomId: newRoomId });
      // Only tell people the first time their room rolls, not every slot after that
      const arrivedByRoll = await ctx.db
        .query("roomMembers")
        .withIndex("by_user", (q) => q.eq("userId", m.userId))
        .filter((q) => q.eq(q.field("movedToRoomId"), roomId))
        .first();
      if (!arrivedByRoll) {
        await notify(ctx, m.userId, `We moved you to ${formatTime(slotStart)}`, roomLink(newRoomId));
      }
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
  handler: async (ctx, { roomId }) => endRoom(ctx, roomId),
});

// Time's up (or too few people left): build the summary circle and have the judge close
// Shuffles the active members into a circle; each person summarizes the next one.
async function assignCircle(ctx: MutationCtx, roomId: Id<"rooms">) {
  const circle = await activeMembers(ctx, roomId);
  for (let i = circle.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [circle[i], circle[j]] = [circle[j], circle[i]];
  }
  for (let i = 0; circle.length >= 2 && i < circle.length; i++) {
    await ctx.db.patch(circle[i]._id, {
      circleOrder: i,
      summarizesUserId: circle[(i + 1) % circle.length].userId,
    });
  }
}

async function endRoom(ctx: MutationCtx, roomId: Id<"rooms">) {
  const room = await ctx.db.get(roomId);
  if (!room || room.status !== "live") return;
  await ctx.db.patch(roomId, { status: "summarizing" });
  // The circle is assigned when the room starts so people know who to listen for.
  // Re-assign only if it's missing or someone in it has left.
  const active = await activeMembers(ctx, roomId);
  const ids = new Set(active.map((m) => m.userId));
  const intact = active.length >= 2 && active.every((m) => m.summarizesUserId && ids.has(m.summarizesUserId));
  if (!intact) await assignCircle(ctx, roomId);
  await ctx.scheduler.runAfter(0, internal.rooms.writeClosing, { roomId });
  await ctx.scheduler.runAfter(0, internal.ai.rateRoomCivility, { roomId });
  await ctx.scheduler.runAfter(0, internal.rooms.estimateEndPositions, { roomId });
}

// Leave a live room early. Costs 10 points and 5 good-faith; ends the room if fewer than 2 remain.
// The lobby screen calls this every 15s so its seat stays taken; also clears seats that went quiet
export const ping = mutation({
  args: { roomId: v.id("rooms"), userId: v.id("users") },
  handler: async (ctx, { roomId, userId }) => {
    const room = await ctx.db.get(roomId);
    if (!room || room.status !== "waiting") return;
    const member = await ctx.db
      .query("roomMembers")
      .withIndex("by_room_and_user", (q) => q.eq("roomId", roomId).eq("userId", userId))
      .unique();
    if (!member) return;
    // Someone who pressed Leave stays gone; only seats that timed out get taken back
    if (member.left && member.leftAt && !member.timedOut) return;
    await ctx.db.patch(member._id, { seenAt: Date.now(), left: false, leftAt: undefined, timedOut: undefined });
    await pruneLobby(ctx, roomId);
    if (member.left) await ctx.scheduler.runAfter(0, internal.rooms.checkStart, { roomId, early: true });
  },
});

export const leave = mutation({
  args: { roomId: v.id("rooms"), userId: v.id("users") },
  handler: async (ctx, { roomId, userId }) => {
    const room = await ctx.db.get(roomId);
    const member = await ctx.db
      .query("roomMembers")
      .withIndex("by_room_and_user", (q) => q.eq("roomId", roomId).eq("userId", userId))
      .unique();
    // Leaving the lobby before the chat starts is free
    if (room?.status === "waiting") {
      if (member && (!member.left || member.timedOut)) {
        await ctx.db.patch(member._id, { left: true, leftAt: Date.now(), timedOut: undefined });
      }
      return;
    }
    if (!room || room.status !== "live") throw new ConvexError("You can only leave a room while the chat is live.");
    if (!member || member.left) throw new ConvexError("You're not in this room.");

    await ctx.db.patch(member._id, { left: true, leftAt: Date.now() });
    const user = await ctx.db.get(userId);
    if (user) {
      await ctx.db.patch(userId, {
        totalPoints: Math.max(0, (user.totalPoints ?? 0) - 10),
        goodFaithScore: Math.max(0, user.goodFaithScore - 5),
      });
    }
    await ctx.db.insert("roomMessages", { roomId, kind: "left", text: `${user?.name ?? "Someone"} left the room.` });

    const remaining = await activeMembers(ctx, roomId);
    if (remaining.length < 2) {
      await endRoom(ctx, roomId);
    } else if (remaining.every((m) => m.wantsToEnd)) {
      await ctx.db.insert("roomMessages", { roomId, kind: "vote", text: "Everyone agreed to wrap up early." });
      await endRoom(ctx, roomId);
    }
  },
});

// Vote to wrap up early. When every member still in the room says yes, it ends like the timer does.
export const voteEnd = mutation({
  args: { roomId: v.id("rooms"), userId: v.id("users"), wantsToEnd: v.boolean() },
  handler: async (ctx, { roomId, userId, wantsToEnd }) => {
    const room = await ctx.db.get(roomId);
    if (!room || room.status !== "live") throw new ConvexError("You can only vote while the chat is live.");
    const member = await ctx.db
      .query("roomMembers")
      .withIndex("by_room_and_user", (q) => q.eq("roomId", roomId).eq("userId", userId))
      .unique();
    if (!member || member.left) throw new ConvexError("You're not in this room.");
    if ((member.wantsToEnd ?? false) === wantsToEnd) return;
    await ctx.db.patch(member._id, { wantsToEnd });
    if (!wantsToEnd) return;

    const active = await activeMembers(ctx, roomId);
    const votes = active.filter((m) => m.wantsToEnd).length;
    if (votes === active.length) {
      await ctx.db.insert("roomMessages", { roomId, kind: "vote", text: "Everyone agreed to wrap up early." });
      await endRoom(ctx, roomId);
      return;
    }
    const name = (await ctx.db.get(userId))?.name ?? "Someone";
    await ctx.db.insert("roomMessages", {
      roomId,
      kind: "vote",
      text: `${name} is ready to wrap up (${votes} of ${active.length}).`,
    });
  },
});

// ---------- Did minds move: AI estimate of where each member ended up ----------

export const endContext = internalQuery({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const room = await ctx.db.get(roomId);
    if (!room) return null;
    const topic = await ctx.db.get(room.topicId);
    if (!topic) return null;
    const msgs = await ctx.db
      .query("roomMessages")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
    const members = await Promise.all(
      (await activeMembers(ctx, roomId)).map(async (m) => ({
        userId: m.userId,
        name: (await ctx.db.get(m.userId))?.name ?? "Someone",
        position: m.position,
        positionAfter: m.positionAfter ?? null,
        messages: msgs.filter((x) => x.kind === "user" && x.userId === m.userId).map((x) => x.text),
      })),
    );
    return {
      status: room.status,
      date: topic.date,
      category: topic.category,
      question: topic.question,
      sideA: topic.sideA,
      sideB: topic.sideB,
      members,
    };
  },
});

export const setEndEstimates = internalMutation({
  args: {
    roomId: v.id("rooms"),
    estimates: v.array(v.object({ userId: v.id("users"), position: v.number(), reason: v.string() })),
  },
  handler: async (ctx, { roomId, estimates }) => {
    for (const e of estimates) {
      const member = await ctx.db
        .query("roomMembers")
        .withIndex("by_room_and_user", (q) => q.eq("roomId", roomId).eq("userId", e.userId))
        .unique();
      if (member) await ctx.db.patch(member._id, { endPositionAI: e.position, endReason: e.reason });
    }
  },
});

type EndContext = NonNullable<FunctionReturnType<typeof internal.rooms.endContext>>;

// Asks the AI where each member stands now, from what they've written so far.
// Returns null if the AI call fails.
async function estimatePositions(d: EndContext, stage: "during" | "after") {
  const prompt = `A group ${stage === "after" ? "just discussed" : "is in the middle of discussing"}: "${d.question}"
0 = fully "${d.sideA}", 100 = fully "${d.sideB}".

For each numbered person you get where they started and everything they wrote.
Estimate where they stand NOW, 0-100, judging only from what they wrote. If they wrote
little or nothing, or never signaled a change, keep their start position.
Give a one-line, neutral reason (no judgement of who is right).

${d.members
  .map(
    (m, i) =>
      `Person ${i + 1}: started at ${m.position}\n${m.messages.length ? m.messages.map((t) => `- ${t}`).join("\n") : "(wrote nothing)"}`,
  )
  .join("\n\n")}

Return ONLY JSON like {"1": {"position": 40, "reason": "..."}, "2": {...}} for persons ${d.members.map((_, i) => i + 1).join(", ")}.`;

  try {
    const r = extractJson<Record<string, { position: number; reason: string }>>(await askClaude(prompt, 600));
    return d.members.flatMap((m, i) => {
      const e = r[String(i + 1)];
      const n = Number(e?.position);
      if (!Number.isFinite(n)) return [];
      return [
        {
          userId: m.userId,
          position: Math.max(0, Math.min(100, Math.round(n))),
          reason: String(e.reason ?? "").slice(0, 200),
        },
      ];
    });
  } catch (e) {
    console.log(`Position estimate (${stage}) failed: ${(e as Error).message}`);
    return null;
  }
}

// During the chat: the judge quietly tracks where each person stands. When someone has
// moved 10+ points from where they started, it says so once, neutrally, and asks what shifted.
export const trackShifts = internalAction({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const d = await ctx.runQuery(internal.rooms.endContext, { roomId });
    if (!d || d.status !== "live" || d.members.length === 0) return;
    if (d.members.every((m) => m.messages.length === 0)) return; // nothing said yet
    const estimates = await estimatePositions(d, "during");
    if (!estimates) return;
    await ctx.runMutation(internal.rooms.setLiveEstimates, { roomId, estimates });
  },
});

export const setLiveEstimates = internalMutation({
  args: {
    roomId: v.id("rooms"),
    estimates: v.array(v.object({ userId: v.id("users"), position: v.number(), reason: v.string() })),
  },
  handler: async (ctx, { roomId, estimates }) => {
    const room = await ctx.db.get(roomId);
    if (!room || room.status !== "live") return;
    const topic = await ctx.db.get(room.topicId);
    const shifted: { name: string; toward: string }[] = [];
    for (const e of estimates) {
      const member = await ctx.db
        .query("roomMembers")
        .withIndex("by_room_and_user", (q) => q.eq("roomId", roomId).eq("userId", e.userId))
        .unique();
      if (!member) continue;
      await ctx.db.patch(member._id, { livePosition: e.position, liveReason: e.reason });
      if (member.shiftNoted || Math.abs(e.position - member.position) < MOVED) continue;
      await ctx.db.patch(member._id, { shiftNoted: true });
      const sameSide = (member.position - 50) * (e.position - 50) >= 0;
      const toward =
        sameSide && Math.abs(e.position - 50) < Math.abs(member.position - 50)
          ? "the middle"
          : `"${e.position < member.position ? topic?.sideA : topic?.sideB}"`;
      shifted.push({ name: (await ctx.db.get(e.userId))?.name ?? "Someone", toward });
    }
    if (shifted.length === 0) return;
    const [first, ...rest] = shifted;
    const text =
      rest.length === 0
        ? `I'm noticing ${first.name}'s view may have moved a little toward ${first.toward} since the start. ${first.name}, what shifted for you? (Changing your mind or not, both are fine.)`
        : `A few views seem to be moving: ${shifted.map((s) => `${s.name} toward ${s.toward}`).join(", ")}. What shifted? (Changing your mind or not, both are fine.)`;
    await ctx.db.insert("roomMessages", { roomId, text, kind: "shift" });
  },
});

export const estimateEndPositions = internalAction({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const d = await ctx.runQuery(internal.rooms.endContext, { roomId });
    if (!d || d.members.length === 0) return;
    const estimates = await estimatePositions(d, "after");
    if (!estimates) return;
    await ctx.runMutation(internal.rooms.setEndEstimates, { roomId, estimates });

    // Save start and end to Supermemory. A slider answer wins: rooms.setPositionAfter saves
    // that one (same memory id), so only members who haven't answered use the AI estimate.
    for (const m of d.members) {
      const est = estimates.find((e) => e.userId === m.userId);
      const after = m.positionAfter ?? est?.position;
      if (after === undefined) continue;
      await ctx.scheduler.runAfter(0, internal.memory.remember, {
        shift: {
          roomId,
          userId: m.userId,
          name: m.name,
          date: d.date,
          category: d.category,
          question: d.question,
          sideA: d.sideA,
          sideB: d.sideB,
          before: m.position,
          after,
        },
      });
    }
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
        aiAfter: m.endPositionAI ?? null, // AI estimate, used when they skip the slider
        reason: m.endReason ?? null,
        live: m.livePosition ?? null, // the judge's latest estimate during the chat
        liveReason: m.liveReason ?? null,
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
