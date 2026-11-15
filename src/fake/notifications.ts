import type { AppNotification, Id } from "../data/types";
import { changed } from "./store";

export const fakeNotifications: AppNotification[] = [
  { _id: "notif_feed", _creationTime: Date.now() - 3 * 3600_000, userId: "", message: "Your feed is ready: 4 topics for today.", link: "practify://", read: false },
  { _id: "notif_room", _creationTime: Date.now() - 60_000, userId: "", message: "Your room starts in 1 minute.", link: "practify://room/room_demo", read: false },
];

export function myNotifications(_args: { userId: Id }): AppNotification[] {
  return [...fakeNotifications].sort((a, b) => b._creationTime - a._creationTime);
}

export async function markRead({ notificationId }: { notificationId: Id }): Promise<null> {
  const n = fakeNotifications.find((x) => x._id === notificationId);
  if (n) n.read = true;
  changed();
  return null;
}
