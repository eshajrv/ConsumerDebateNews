import { useEffect, useState } from "react";

import { useRoomIfAny } from "./data";
import { clearSavedRoomId, getSavedRoomId } from "./session";

// If you left the app while in a lobby or a live chat, where to send you back to.
// `checking` stays true until the saved room (if any) has been looked up.
export function useResumeRoom(userId: string | null | undefined) {
  const [roomId, setRoomId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    getSavedRoomId().then(setRoomId);
  }, []);

  const room = useRoomIfAny(userId ? (roomId ?? null) : null);
  const stillIn =
    !!room && !!userId && (room.status === "waiting" || room.status === "live") && room.members.some((m) => m.userId === userId);
  const stale = !!roomId && !!userId && room !== undefined && !stillIn;

  useEffect(() => {
    if (stale) clearSavedRoomId();
  }, [stale]);

  if (!userId) return { checking: userId === undefined, target: null };
  if (roomId === undefined || (roomId && room === undefined)) return { checking: true, target: null };
  if (!stillIn || !room) return { checking: false, target: null };
  return { checking: false, target: room.status === "live" ? `/room/${room._id}/chat` : `/room/${room._id}` };
}
