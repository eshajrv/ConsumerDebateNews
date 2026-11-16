import { makeFunctionReference } from "convex/server";

import type {
  GuessPick,
  Id,
  LeaderboardEntry,
  FeaturedRoom,
  Inbox,
  LeaderboardPeriod,
  LiveRoom,
  MindsMoved,
  MyRank,
  NextRoom,
  OnboardArgs,
  Room,
  RoomMessage,
  RoomMode,
  RoomSummaries,
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
    next: query<{ topicId: Id; now: number; mode?: RoomMode }, NextRoom>("rooms:next"),
    join: mutation<{ userId: Id; topicId: Id; allowSpectators?: boolean; mode?: RoomMode }, Id>("rooms:join"),
    get: query<{ roomId: Id }, Room | null>("rooms:get"),
    messages: query<{ roomId: Id }, RoomMessage[]>("rooms:messages"),
    send: mutation<{ roomId: Id; userId: Id; text: string }, null>("rooms:send"),
    live: query<{ topicId?: Id }, LiveRoom[]>("rooms:live"),
    featured: query<{ topicId?: Id; now?: number }, FeaturedRoom | null>("rooms:featured"),
    setPositionAfter: mutation<{ roomId: Id; userId: Id; position: number }, null>("rooms:setPositionAfter"),
    mindsMoved: query<{ roomId: Id }, MindsMoved>("rooms:mindsMoved"),
    leave: mutation<{ roomId: Id; userId: Id }, null>("rooms:leave"),
  },
  summaries: {
    forRoom: query<{ roomId: Id; userId: Id }, RoomSummaries | null>("summaries:forRoom"),
    submit: mutation<{ roomId: Id; authorId: Id; text: string }, null>("summaries:submit"),
    guess: mutation<{ summaryId: Id; userId: Id; pick: GuessPick }, null>("summaries:guess"),
    rate: mutation<{ summaryId: Id; userId: Id; gotMeRating: number }, null>("summaries:rate"),
  },
  notifications: {
    mine: query<{ userId: Id }, Inbox>("notifications:mine"),
    markRead: mutation<{ notificationId: Id }, null>("notifications:markRead"),
    markAllRead: mutation<{ userId: Id }, null>("notifications:markAllRead"),
  },
  links: {
    redeem: mutation<{ code: string }, { userId: Id; roomId: Id }>("links:redeem"),
  },
  leaderboard: {
    top: query<{ period: LeaderboardPeriod; date: string }, LeaderboardEntry[]>("leaderboard:top"),
    myRank: query<{ userId: Id; period: LeaderboardPeriod; date: string }, MyRank>("leaderboard:myRank"),
  },
};
