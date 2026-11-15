export const FAKE = {
  users: false,
  feed: false,
  rooms: false,
  summaries: false,
  notifications: false,
  leaderboard: false,
  links: false,
};

export type DataArea = keyof typeof FAKE;

// Send the 1-on-1 / Group choice to rooms.next and rooms.join. Flip on once convex/ accepts `mode`.
export const ROOM_MODES = false;

export const ANY_LIVE = Object.values(FAKE).some((fake) => !fake);
