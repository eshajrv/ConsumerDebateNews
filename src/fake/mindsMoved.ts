import type { Id, MindsMoved, MindsMovedMember, Room } from "../data/types";
import { getRoom } from "./rooms";
import { changed } from "./store";

const MOVED_POINTS = 5;
const PULL_TO_MIDDLE = 0.3;

const liveRooms = new Map<Id, Room>();
const positionsAfter = new Map<Id, Map<Id, number>>();

export function rememberRoom(room: Room) {
  liveRooms.set(room._id, room);
}

// Once you answer, the other members answer too: every third one holds, the rest drift toward the room's middle.
export async function setPositionAfter({ roomId, userId, position }: { roomId: Id; userId: Id; position: number }): Promise<null> {
  const room = liveRooms.get(roomId) ?? getRoom({ roomId });
  const saved = positionsAfter.get(roomId) ?? new Map<Id, number>();
  if (room && saved.size === 0) {
    const middle = room.members.reduce((sum, m) => sum + m.position, 0) / room.members.length;
    room.members.forEach((m, i) => {
      saved.set(m.userId, i % 3 === 2 ? m.position : Math.round(m.position + (middle - m.position) * PULL_TO_MIDDLE));
    });
  }
  saved.set(userId, position);
  positionsAfter.set(roomId, saved);
  changed();
  return null;
}

export function mindsMoved({ roomId }: { roomId: Id }): MindsMoved | null {
  const room = liveRooms.get(roomId) ?? getRoom({ roomId });
  if (!room) return null;
  const saved = positionsAfter.get(roomId);
  const members: MindsMovedMember[] = room.members.map((m) => {
    const after = saved?.get(m.userId) ?? null;
    const moved = after !== null && Math.abs(after - m.position) >= MOVED_POINTS;
    const toward = moved
      ? room.members
          .filter((o) => o.userId !== m.userId && Math.sign(o.position - m.position) === Math.sign(after - m.position))
          .sort((a, b) => Math.abs(a.position - after) - Math.abs(b.position - after))[0]
      : undefined;
    return { userId: m.userId, name: m.name, before: m.position, after, moved, towardName: toward?.name ?? null };
  });
  return { moved: members.filter((m) => m.moved).length, total: members.length, members };
}
