import { FAKE } from "../config";
import type { AppNotification, Id, Inbox } from "../data/types";
import { changed } from "./store";

const roomLink = (path: string) => (FAKE.rooms ? `practify://room/room_demo${path}` : undefined);

export const fakeNotifications: AppNotification[] = [
  { _id: "notif_feed", _creationTime: Date.now() - 3 * 3600_000, userId: "", message: "Today's feed is ready", link: "practify://home", read: false },
  { _id: "notif_results", _creationTime: Date.now() - 20 * 60_000, userId: "", message: "Your results are in", link: roomLink("/summary"), read: false },
  { _id: "notif_room", _creationTime: Date.now() - 60_000, userId: "", message: "Your 8:15 room is starting", link: roomLink(""), read: false },
];

export function myNotifications(_args: { userId: Id }): Inbox {
  return {
    notifications: [...fakeNotifications].sort((a, b) => b._creationTime - a._creationTime),
    unreadCount: fakeNotifications.filter((n) => !n.read).length,
  };
}

export async function markRead({ notificationId }: { notificationId: Id }): Promise<null> {
  const n = fakeNotifications.find((x) => x._id === notificationId);
  if (n) n.read = true;
  changed();
  return null;
}

export async function markAllRead(_args: { userId: Id }): Promise<null> {
  for (const n of fakeNotifications) n.read = true;
  changed();
  return null;
}
