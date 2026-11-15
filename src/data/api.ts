import { makeFunctionReference } from "convex/server";

import type {
  AppNotification,
  Id,
  LeaderboardPeriod,
  LiveRoom,
  NextRoom,
  OnboardArgs,
  Room,
  RoomMessage,
  Summary,
  Topic,
  TopicStats,
  User,
} from "./types";

const query = <A extends Record<string, unknown>, R>(name: string) => makeFunctionReference<"query", A, R>(name);
const mutation = <A extends Record<string, unknown>, R>(name: string) => makeFunctionReference<"mutation", A, R>(name);

export const api = {
  users: {
    onboard: mutation<OnboardArgs, Id>("users:onboard"),
    get: query<{ userId: Id }, User | null>("users:get"),
    setStance: mutation<{ userId: Id; topicId: Id; position: number; today: string }, null>("users:setStance"),
  },
  feed: {
    forUser: query<{ userId: Id; date: string }, Topic[]>("feed:forUser"),
  },
  dailyTopics: {
    stats: query<{ topicId: Id }, TopicStats>("dailyTopics:stats"),
  },
  rooms: {
    next: query<{ topicId: Id; now: number }, NextRoom>("rooms:next"),
    join: mutation<{ userId: Id; topicId: Id; allowSpectators?: boolean }, Id>("rooms:join"),
    get: query<{ roomId: Id }, Room | null>("rooms:get"),
    messages: query<{ roomId: Id }, RoomMessage[]>("rooms:messages"),
    send: mutation<{ roomId: Id; userId: Id; text: string }, null>("rooms:send"),
    live: query<{ topicId?: Id }, LiveRoom[]>("rooms:live"),
  },
  summaries: {
    forRoom: query<{ roomId: Id }, Summary[]>("summaries:forRoom"),
    submit: mutation<{ roomId: Id; authorId: Id; text: string }, null>("summaries:submit"),
    guess: mutation<{ summaryId: Id; userId: Id; pick: "first" | "second" }, null>("summaries:guess"),
    rate: mutation<{ summaryId: Id; userId: Id; gotMeRating: number }, null>("summaries:rate"),
  },
  leaderboard: {
    myRank: query<{ userId: Id; period: LeaderboardPeriod }, number | null>("leaderboard:myRank"),
  },
  notifications: {
    mine: query<{ userId: Id }, AppNotification[]>("notifications:mine"),
    markRead: mutation<{ notificationId: Id }, null>("notifications:markRead"),
  },
};
