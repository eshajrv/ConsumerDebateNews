import type { Band, FeaturedRoom, Id, LiveRoom, MindsMoved, NextRoom, Room, RoomMember, RoomMessage, RoomMessageKind, RoomMode } from "../data/types";
import { getTopic } from "./feed";
import { changed, newId } from "./store";
import { getUser, stances } from "./users";

const SLOT_MINUTES = 2;
const SLOT_MS = SLOT_MINUTES * 60_000;
const CHAT_MS = 10 * 60_000;
const MIN_LOBBY_MS = 30_000;

const nextSlot = (now = Date.now()) => {
  const slot = Math.ceil(now / SLOT_MS) * SLOT_MS;
  return slot - now < MIN_LOBBY_MS ? slot + SLOT_MS : slot;
};
const bandOf = (position: number): Band => (position <= 35 ? "A" : position >= 65 ? "B" : "M");

const FAKE_MEMBERS: RoomMember[] = [
  { userId: "user_maya", name: "Maya", position: 12, band: "A" },
  { userId: "user_jordan", name: "Jordan", position: 88, band: "B" },
  { userId: "user_priya", name: "Priya", position: 45, band: "M" },
];

const REPLIES: Record<string, string[]> = {
  user_maya: [
    "I hear you, but I keep coming back to who pays the price if this goes wrong.",
    "What would it take to change your mind on that?",
    "That's fair. I still think the downside is bigger than people admit.",
    "Okay, I can see why that matters to you. I just weigh it differently.",
  ],
  user_jordan: [
    "I see it differently. Doing nothing has costs too, they're just harder to see.",
    "Can you say more about why that part matters most to you?",
    "Honestly that's a better argument than I expected.",
    "I think we agree on the goal, just not on how fast to get there.",
  ],
  user_priya: [
    "I'm somewhere in the middle. You both have a point about the tradeoffs.",
    "Maybe it depends on the situation more than the principle?",
    "What if we tried it small first and looked at what actually happens?",
    "I like that we're all saying 'it depends'. That feels like progress.",
  ],
};
const replyIndex: Record<string, number> = {};
let userMessageCount = 0;

const openerFor = (members: RoomMember[]) => {
  const furthest = [...members].sort((a, b) => Math.abs(b.position - 50) - Math.abs(a.position - 50))[0];
  return `Everyone here wants to get this right, even if you land in different places. ${furthest.name}, what's the strongest reason behind your view?`;
};

const demoOpener =
  "Everyone here agrees AI tools are already changing how code gets written. Jordan, what would it take for you to trust code you didn't write?";

export const fakeRooms: Room[] = [
  {
    _id: "room_demo",
    _creationTime: Date.now() - 5 * 60_000,
    topicId: "topic_ai_code",
    slotStart: Date.now() - 2 * 60_000,
    status: "live",
    endsAt: Date.now() + 8 * 60_000,
    topic: getTopic("topic_ai_code") ?? null,
    members: FAKE_MEMBERS.map((m) => ({ ...m })),
  },
];

export const fakeMessages: RoomMessage[] = [
  { _id: "msg_1", _creationTime: Date.now() - 120_000, roomId: "room_demo", kind: "opener", text: demoOpener },
  { _id: "msg_2", _creationTime: Date.now() - 90_000, roomId: "room_demo", userId: "user_jordan", kind: "user", text: "Honestly, tests. If the tests are good I care less who wrote it." },
  { _id: "msg_3", _creationTime: Date.now() - 60_000, roomId: "room_demo", userId: "user_maya", kind: "user", text: "But who writes the tests? If that's AI too, it's checking its own homework." },
  { _id: "msg_4", _creationTime: Date.now() - 30_000, roomId: "room_demo", userId: "user_priya", kind: "user", text: "I think it depends on the stage. A prototype is different from a bank's backend." },
];

const post = (roomId: Id, userId: Id | null, text: string, kind: RoomMessageKind = userId ? "user" : "nudge") => {
  fakeMessages.push({ _id: newId("msg"), _creationTime: Date.now(), roomId, userId: userId ?? undefined, kind, text });
  changed();
};

function assignCircle(room: Room) {
  const circle = [...room.members].sort(() => Math.random() - 0.5);
  circle.forEach((m, i) => {
    m.summarizesUserId = circle[(i + 1) % circle.length].userId;
  });
}

function tick() {
  const now = Date.now();
  for (const room of fakeRooms) {
    if ((room.status === "waiting" || room.status === "rolled") && now >= room.slotStart) {
      const positions = room.members.map((m) => m.position);
      const canStart = room.members.length >= 3 && Math.max(...positions) - Math.min(...positions) >= 40;
      if (canStart) {
        room.status = "live";
        room.endsAt = now + CHAT_MS;
        post(room._id, null, openerFor(room.members), "opener");
      } else {
        room.status = "rolled";
        room.slotStart += SLOT_MS;
        changed();
      }
    } else if (room.status === "live" && room.endsAt && now >= room.endsAt) {
      room.status = "summarizing";
      assignCircle(room);
      room.agreementLine = "You all agreed the tradeoffs are real, even where you landed differently.";
      post(room._id, null, `Time's up. ${room.agreementLine}`, "closing");
    }
  }
}
setInterval(tick, 1000);

const capacity = (mode?: RoomMode) => (mode === "duo" ? 2 : 6);
const startingMembers = (mode?: RoomMode) => (mode === "duo" ? FAKE_MEMBERS.slice(0, 1) : FAKE_MEMBERS);
const openRoom = (topicId: Id, slot: number, mode?: RoomMode) =>
  fakeRooms.find((r) => r.topicId === topicId && r.slotStart === slot && r.status === "waiting" && r.members.length < capacity(mode));

export function nextRoom({ topicId, now, mode }: { topicId: Id; now: number; mode?: RoomMode }): NextRoom {
  const slot = nextSlot(now);
  const room = openRoom(topicId, slot, mode);
  return { slot, joinedCount: room ? room.members.length : startingMembers(mode).length };
}

export async function joinRoom({ userId, topicId, mode }: { userId: Id; topicId: Id; allowSpectators?: boolean; mode?: RoomMode }): Promise<Id> {
  const slot = nextSlot();
  let room = openRoom(topicId, slot, mode);
  if (!room) {
    room = {
      _id: newId("room"),
      _creationTime: Date.now(),
      topicId,
      slotStart: slot,
      status: "waiting",
      mode: mode ?? "group",
      topic: getTopic(topicId) ?? null,
      members: startingMembers(mode).map((m) => ({ ...m })),
    };
    fakeRooms.push(room);
  }
  if (!room.members.some((m) => m.userId === userId)) {
    const position = stances.find((s) => s.userId === userId && s.topicId === topicId)?.position ?? 50;
    room.members.push({ userId, name: getUser({ userId })?.name ?? "You", position, band: bandOf(position) });
  }
  changed();
  return room._id;
}

export function getRoom({ roomId }: { roomId: Id }): Room | null {
  return fakeRooms.find((r) => r._id === roomId) ?? null;
}

export function roomMessages({ roomId }: { roomId: Id }): RoomMessage[] {
  return fakeMessages.filter((m) => m.roomId === roomId);
}

export async function sendMessage({ roomId, userId, text }: { roomId: Id; userId: Id; text: string }): Promise<null> {
  const room = getRoom({ roomId });
  if (!room || room.status !== "live") return null;
  if (!room.members.some((m) => m.userId === userId)) {
    const position = stances.find((s) => s.userId === userId && s.topicId === room.topicId)?.position ?? 50;
    room.members.push({ userId, name: getUser({ userId })?.name ?? "You", position, band: bandOf(position) });
  }
  post(roomId, userId, text.trim().slice(0, 500));
  userMessageCount++;

  const others = room.members.filter((m) => REPLIES[m.userId] && m.userId !== userId);
  const replier = others[userMessageCount % others.length];
  if (replier) {
    setTimeout(() => {
      if (room.status !== "live") return;
      const lines = REPLIES[replier.userId];
      const i = replyIndex[replier.userId] ?? 0;
      replyIndex[replier.userId] = i + 1;
      post(roomId, replier.userId, lines[i % lines.length]);
    }, 1500 + Math.random() * 1500);
  }

  if (userMessageCount % 3 === 0) {
    const you = room.members.find((m) => m.userId === userId);
    const other = others[(userMessageCount + 1) % others.length];
    setTimeout(() => {
      if (room.status !== "live" || !other) return;
      post(roomId, null, `${other.name}, before you answer, can you put ${you?.name ?? "their"}'s point in your own words?`);
    }, 4500);
  }
  return null;
}

export function liveRooms({ topicId }: { topicId?: Id }): LiveRoom[] {
  return fakeRooms
    .filter((r) => r.status === "live" && (!topicId || r.topicId === topicId))
    .map((r) => ({
      _id: r._id,
      topicId: r.topicId,
      question: getTopic(r.topicId)?.question ?? "",
      endsAt: r.endsAt,
      members: r.members.map(({ name, position, band }) => ({ name, position, band })),
    }));
}

const positionsAfter: Record<string, number> = {}; // `${roomId}:${userId}` -> 0-100

export async function setPositionAfter({ roomId, userId, position }: { roomId: Id; userId: Id; position: number }): Promise<null> {
  positionsAfter[`${roomId}:${userId}`] = Math.max(0, Math.min(100, Math.round(position)));
  changed();
  return null;
}

export function mindsMoved({ roomId }: { roomId: Id }): MindsMoved {
  const room = getRoom({ roomId });
  const members = (room?.members ?? []).map((m) => {
    const after = positionsAfter[`${roomId}:${m.userId}`] ?? null;
    return { userId: m.userId, name: m.name, before: m.position, after, shift: after === null ? null : after - m.position, aiAfter: null, reason: null, live: null, liveReason: null };
  });
  const gap = (ps: number[]) => (ps.length ? Math.max(...ps) - Math.min(...ps) : 0);
  return {
    members,
    movedCount: members.filter((m) => m.shift !== null && Math.abs(m.shift) >= 10).length,
    total: members.length,
    averageGapBefore: gap(members.map((m) => m.before)),
    averageGapAfter: gap(members.map((m) => m.after ?? m.before)),
  };
}

export async function leaveRoom(_args: { roomId: Id; userId: Id }): Promise<null> {
  return null;
}

export function featuredRoom(_args: { topicId?: Id; now?: number }): FeaturedRoom | null {
  const room = liveRooms({})[0];
  return room ? { ...room, recentMessages: fakeMessages.filter((m) => m.roomId === room._id).length } : null;
}
