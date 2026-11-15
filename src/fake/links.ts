import type { Id } from "../data/types";

export async function redeem({ code }: { code: string }): Promise<{ userId: Id; roomId: Id }> {
  if (!/^\d{6}$/.test(code.trim())) throw new Error("That code doesn't match a room.");
  return { userId: "user_jordan", roomId: "room_demo" };
}
