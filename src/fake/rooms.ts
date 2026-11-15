import type { Band, Id, LiveRoom, NextRoom, Room, RoomMessage } from "../data/types";
import { getTopic } from "./feed";
import { changed, newId } from "./store";
import { getUser, stances } from "./users";

const SLOT_MINUTES = 15;
const nextSlot = () => Math.ceil(Date.now() / (SLOT_MINUTES * 60_000)) * SLOT_MINUTES * 60_000;
const bandOf = (position: number): Band => (position <= 35 ? "A" : position >= 65 ? "B" : "M");

export const fakeRooms: Room[] = [
  {
    _id: "room_demo",
    topicId: "topic_ai_code",
    slot: Date.now() - 2 * 60_000,
    status: "live",
    endsAt: Date.now() + 8 * 60_000,
    opener: "Everyone here agrees AI tools are already changing how code gets written. Jordan, what would it take for you to trust code you didn't write?",
    members: [
      { userId: "user_maya", name: "Maya", position: 12, band: "A", summarizesUserId: "user_jordan" },
      { userId: "user_jordan", name: "Jordan", position: 88, band: "B", summarizesUserId: "user_priya" },
      { userId: "user_priya", name: "Priya", position: 45, band: "M", summarizesUserId: "user_sam" },
      { userId: "user_sam", name: "Sam", position: 70, band: "B", summarizesUserId: "user_leo" },
      { userId: "user_leo", name: "Leo", position: 30, band: "A", summarizesUserId: "user_maya" },
    ],
  },
];

export const fakeMessages: RoomMessage[] = [
  { _id: "msg_1", _creationTime: Date.now() - 120_000, roomId: "room_demo", userId: null, isJudge: true, flagged: false, text: fakeRooms[0].opener! },
  { _id: "msg_2", _creationTime: Date.now() - 90_000, roomId: "room_demo", userId: "user_jordan", isJudge: false, flagged: false, text: "Honestly, tests. If the tests are good I care less who wrote it." },
  { _id: "msg_3", _creationTime: Date.now() - 60_000, roomId: "room_demo", userId: "user_maya", isJudge: false, flagged: false, text: "But who writes the tests? If that's AI too, it's checking its own homework." },
  { _id: "msg_4", _creationTime: Date.now() - 30_000, roomId: "room_demo", userId: "user_priya", isJudge: false, flagged: false, text: "I think it depends on the stage. A prototype is different from a bank's backend." },
];

export function nextRoom({ topicId }: { topicId: Id }): NextRoom {
  const slot = nextSlot();
  const joined = fakeRooms.filter((r) => r.topicId === topicId && r.slot === slot);
  return { slot, joinedCount: joined.reduce((n, r) => n + r.members.length, 0) + 3 };
}

export async function joinRoom({ userId, topicId }: { userId: Id; topicId: Id }): Promise<Id> {
  const slot = nextSlot();
  let room = fakeRooms.find((r) => r.topicId === topicId && r.slot === slot && r.members.length < 6);
  if (!room) {
    room = { _id: newId("room"), topicId, slot, status: "waiting", members: [] };
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
  fakeMessages.push({ _id: newId("msg"), _creationTime: Date.now(), roomId, userId, isJudge: false, flagged: false, text: text.trim() });
  changed();
  return null;
}

export function liveRooms({ topicId }: { topicId?: Id }): LiveRoom[] {
  return fakeRooms
    .filter((r) => r.status === "live" && (!topicId || r.topicId === topicId))
    .map((r) => ({ _id: r._id, topicId: r.topicId, question: getTopic(r.topicId)?.question ?? "", memberCount: r.members.length, endsAt: r.endsAt ?? Date.now() }));
}
