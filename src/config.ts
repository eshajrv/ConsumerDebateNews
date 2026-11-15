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

export const ANY_LIVE = Object.values(FAKE).some((fake) => !fake);
