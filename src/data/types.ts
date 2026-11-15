// Shapes returned by convex/ (users.get, feed.forUser, rooms.*, dailyTopics.stats, notifications.*, leaderboard.*).
// Id<"table"> documents which table an id belongs to; on the wire every id is a string.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type Id<Table extends string = string> = string;

export type Interest = "tech" | "politics" | "culture" | "sports" | "campus";
export type NotifyVia = "app" | "text";
export type Band = "A" | "M" | "B";

export type User = {
  _id: Id<"users">;
  _creationTime: number;
  name: string;
  goodFaithScore: number;
  streak: number;
  lastActiveDate?: string;
  insight?: string;
  phone?: string;
  interests?: string[];
  notifyVia?: NotifyVia;
  totalPoints?: number;
};

export type Topic = {
  _id: Id<"topics">;
  _creationTime: number;
  date: string;
  category: string;
  question: string;
  sideA: string;
  sideB: string;
  brief: string;
  sideAView: string;
  sideBView: string;
  sources: string[];
  status: string;
  isShared?: boolean;
};

export type TopicStats = { total: number; leanA: number; leanB: number; talkingNow: number };

export type NextRoom = { slot: number; joinedCount: number };

export type RoomStatus = "waiting" | "live" | "rolled" | "summarizing" | "done";

export type RoomMember = {
  userId: Id<"users">;
  name: string;
  position: number;
  band: Band;
  circleOrder?: number;
  summarizesUserId?: Id<"users">;
};

export type Room = {
  _id: Id<"rooms">;
  _creationTime: number;
  topicId: Id<"topics">;
  slotStart: number;
  status: RoomStatus;
  endsAt?: number;
  agreementLine?: string;
  allowSpectators?: boolean;
  topic: Topic | null;
  members: RoomMember[];
};

export type RoomMessageKind = "user" | "opener" | "nudge" | "flag" | "closing";

export type RoomMessage = {
  _id: Id<"roomMessages">;
  _creationTime: number;
  roomId: Id<"rooms">;
  userId?: Id<"users">;
  text: string;
  kind: RoomMessageKind;
  flagged?: boolean;
};

export type LiveRoom = {
  _id: Id<"rooms">;
  topicId: Id<"topics">;
  question: string;
  endsAt?: number;
  members: { name: string; position: number; band: Band }[];
};

// rooms.mindsMoved: before is the stance at join; after and shift (after - before) are null until rooms.setPositionAfter.
// movedCount counts members whose |shift| is 10 or more.
export type MindsMovedMember = { userId: Id<"users">; name: string; before: number; after: number | null; shift: number | null };

export type MindsMoved = {
  members: MindsMovedMember[];
  movedCount: number;
  total: number;
  averageGapBefore: number;
  averageGapAfter: number;
};

export type GuessPick = "first" | "second";

export type Summary = {
  _id: Id<"summaries">;
  authorId: Id<"users">;
  authorName: string;
  aboutUserId: Id<"users">;
  aboutName: string;
  aboutMe: boolean;
  ready: boolean;
  options: [string, string] | null;
  guessed: boolean;
  subjectGuess: string | null;
  humanIs: GuessPick | null;
  gotMeRating: number | null;
  points: number | null;
};

export type RoomSummaries = {
  status: RoomStatus;
  agreementLine: string | null;
  summaries: Summary[];
};

export type AppNotification = {
  _id: Id<"notifications">;
  _creationTime: number;
  userId: Id<"users">;
  message: string;
  link?: string;
  read: boolean;
};

// notifications.mine: newest first (max 50)
export type Inbox = { notifications: AppNotification[]; unreadCount: number };

export type LeaderboardPeriod = "today" | "week";

// leaderboard.top: points summed from dailyPoints over the period's Pacific dates; ties share a rank
export type LeaderboardEntry = { rank: number; userId: Id<"users">; name: string; points: number };

// leaderboard.myRank: rank is null until the user has points in the period
export type MyRank = { rank: number | null; points: number };

export type OnboardArgs = {
  name: string;
  interests: Interest[];
  notifyVia: NotifyVia;
  phone?: string;
};
