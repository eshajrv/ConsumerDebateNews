// Shapes returned by convex/ (users.get, feed.forUser, rooms.*, dailyTopics.stats).
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

export type Summary = {
  _id: Id<"summaries">;
  authorId: Id<"users">;
  aboutUserId: Id<"users">;
  ready: boolean;
  options: [string, string] | null;
  guessed: boolean;
  humanIs?: "first" | "second";
  gotMeRating?: number;
  points?: number;
};

export type LeaderboardPeriod = "today" | "week";

export type AppNotification = {
  _id: Id<"notifications">;
  _creationTime: number;
  userId: Id<"users">;
  message: string;
  link?: string;
  read: boolean;
};

export type OnboardArgs = {
  name: string;
  interests: Interest[];
  notifyVia: NotifyVia;
  phone?: string;
};
