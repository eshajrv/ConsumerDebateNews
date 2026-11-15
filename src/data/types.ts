export type Id = string;

export type Interest = "tech" | "politics" | "culture" | "sports" | "campus";
export type NotifyVia = "app" | "text";
export type Band = "A" | "M" | "B";

export type User = {
  _id: Id;
  name: string;
  interests: Interest[];
  notifyVia: NotifyVia;
  phone?: string;
  goodFaithScore: number;
  streak: number;
  totalPoints: number;
  insight?: string;
};

export type Topic = {
  _id: Id;
  date: string;
  category: Interest;
  question: string;
  sideA: string;
  sideB: string;
  brief: string;
  sideAView: string;
  sideBView: string;
  sources: string[];
  isShared: boolean;
};

export type TopicStats = { total: number; leanA: number; leanB: number; talkingNow: number };

export type NextRoom = { slot: number; joinedCount: number };

export type RoomStatus = "waiting" | "live" | "rolled" | "summarizing" | "done";

export type RoomMember = {
  userId: Id;
  name: string;
  position: number;
  band: Band;
  summarizesUserId?: Id;
};

export type Room = {
  _id: Id;
  topicId: Id;
  slot: number;
  status: RoomStatus;
  endsAt?: number;
  opener?: string;
  agreementLine?: string;
  members: RoomMember[];
};

export type RoomMessage = {
  _id: Id;
  _creationTime: number;
  roomId: Id;
  userId: Id | null;
  isJudge: boolean;
  flagged: boolean;
  text: string;
};

export type LiveRoom = { _id: Id; topicId: Id; question: string; memberCount: number; endsAt: number };

export type Summary = {
  _id: Id;
  authorId: Id;
  aboutUserId: Id;
  ready: boolean;
  options: [string, string] | null;
  guessed: boolean;
  humanIs?: "first" | "second";
  gotMeRating?: number;
  points?: number;
};

export type AppNotification = {
  _id: Id;
  _creationTime: number;
  userId: Id;
  message: string;
  link?: string;
  read: boolean;
};

export type LeaderboardPeriod = "today" | "week";

export type LeaderboardEntry = { rank: number; userId: Id; name: string; points: number; goodFaithScore: number };

export type OnboardArgs = {
  name: string;
  interests: Interest[];
  notifyVia: NotifyVia;
  phone?: string;
};
