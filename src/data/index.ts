import { useMutation, useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";
import { useEffect, useSyncExternalStore } from "react";

import { type DataArea, FAKE } from "../config";
import { pacificDate, useNow } from "../date";
import * as feed from "../fake/feed";
import * as leaderboard from "../fake/leaderboard";
import * as links from "../fake/links";
import * as mindsMoved from "../fake/mindsMoved";
import * as notifications from "../fake/notifications";
import * as rooms from "../fake/rooms";
import { getVersion, subscribe } from "../fake/store";
import * as summaries from "../fake/summaries";
import * as users from "../fake/users";
import { api } from "./api";
import type { Id, LeaderboardPeriod } from "./types";

export * from "./types";

type Args = Record<string, unknown>;
type QueryRef<A extends Args, R> = FunctionReference<"query", "public", A, R>;
type MutationRef<A extends Args, R> = FunctionReference<"mutation", "public", A, R>;

function useFakeQuery<A extends Args, R>(_ref: QueryRef<A, R>, args: A | "skip", read: (args: A) => R): R | undefined {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  return args === "skip" ? undefined : read(args);
}

function useConvexQuery<A extends Args, R>(ref: QueryRef<A, R>, args: A | "skip"): R | undefined {
  return useQuery(ref as QueryRef<any, R>, args as any);
}

function useFakeMutation<A extends Args, R>(_ref: MutationRef<A, R>, run: (args: A) => Promise<R>) {
  return run;
}

function useConvexMutation<A extends Args, R>(ref: MutationRef<A, R>): (args: A) => Promise<R> {
  return useMutation(ref as MutationRef<any, R>);
}

const dataHook = (area: DataArea) => (FAKE[area] ? useFakeQuery : useConvexQuery);
const actionHook = (area: DataArea) => (FAKE[area] ? useFakeMutation : useConvexMutation);

const useUsersData = dataHook("users");
const useUsersAction = actionHook("users");
const useFeedData = dataHook("feed");
const useRoomsData = dataHook("rooms");
const useRoomsAction = actionHook("rooms");
const useSummariesData = dataHook("summaries");
const useSummariesAction = actionHook("summaries");
const useNotificationsData = dataHook("notifications");
const useNotificationsAction = actionHook("notifications");
const useLeaderboardData = dataHook("leaderboard");
const useLinksAction = actionHook("links");
const useMindsMovedData = dataHook("mindsMoved");
const useMindsMovedAction = actionHook("mindsMoved");

const BRIDGE_ROOMS_TO_FAKE_SUMMARIES = !FAKE.rooms && FAKE.summaries;
const BRIDGE_ROOMS_TO_FAKE_MINDS_MOVED = !FAKE.rooms && FAKE.mindsMoved;

const skipUnless = <A extends Args>(ready: unknown, args: A): A | "skip" => (ready ? args : "skip");

export const useOnboard = () => useUsersAction(api.users.onboard, users.onboard);
export const useUser = (userId: Id | null) => useUsersData(api.users.get, skipUnless(userId, { userId: userId! }), users.getUser);
export const useSetStance = () => useUsersAction(api.users.setStance, users.setStance);

export const useFeed = (userId: Id | null, date: string) =>
  useFeedData(api.feed.forUser, skipUnless(userId, { userId: userId!, date }), feed.forUser);
export const useTopicStats = (topicId: Id) => useFeedData(api.dailyTopics.stats, { topicId }, feed.topicStats);

export const useNextRoom = (topicId: Id) => {
  const minute = Math.floor(useNow(15_000) / 60_000) * 60_000;
  return useRoomsData(api.rooms.next, { topicId, now: minute }, rooms.nextRoom);
};
export const useJoinRoom = () => useRoomsAction(api.rooms.join, rooms.joinRoom);
export const useRoom = (roomId: Id) => {
  const room = useRoomsData(api.rooms.get, { roomId }, rooms.getRoom);
  useEffect(() => {
    if (BRIDGE_ROOMS_TO_FAKE_SUMMARIES && room) summaries.rememberRoom(room);
    if (BRIDGE_ROOMS_TO_FAKE_MINDS_MOVED && room) mindsMoved.rememberRoom(room);
  }, [room]);
  return room;
};
export const useRoomMessages = (roomId: Id) => useRoomsData(api.rooms.messages, { roomId }, rooms.roomMessages);
export const useSendMessage = () => useRoomsAction(api.rooms.send, rooms.sendMessage);
export const useSetPositionAfter = () => useMindsMovedAction(api.rooms.setPositionAfter, mindsMoved.setPositionAfter);
export const useMindsMoved = (roomId: Id) => useMindsMovedData(api.rooms.mindsMoved, { roomId }, mindsMoved.mindsMoved);
export const useLiveRooms = (topicId?: Id) => useRoomsData(api.rooms.live, topicId ? { topicId } : {}, rooms.liveRooms);

export const useRoomSummaries = (roomId: Id, userId: Id | null) =>
  useSummariesData(api.summaries.forRoom, skipUnless(userId, { roomId, userId: userId! }), summaries.summariesForRoom);
export const useSubmitSummary = () => useSummariesAction(api.summaries.submit, summaries.submitSummary);
export const useGuessSummary = () => useSummariesAction(api.summaries.guess, summaries.guessSummary);
export const useRateSummary = () => useSummariesAction(api.summaries.rate, summaries.rateSummary);

export const useNotifications = (userId: Id | null) =>
  useNotificationsData(api.notifications.mine, skipUnless(userId, { userId: userId! }), notifications.myNotifications);
export const useMarkRead = () => useNotificationsAction(api.notifications.markRead, notifications.markRead);
export const useMarkAllRead = () => useNotificationsAction(api.notifications.markAllRead, notifications.markAllRead);

export const useRedeemLink = () => useLinksAction(api.links.redeem, links.redeem);

export const useLeaderboard = (period: LeaderboardPeriod) =>
  useLeaderboardData(api.leaderboard.top, { period, date: pacificDate() }, leaderboard.top);
export const useMyRank = (userId: Id | null, period: LeaderboardPeriod) =>
  useLeaderboardData(api.leaderboard.myRank, skipUnless(userId, { userId: userId!, period, date: pacificDate() }), leaderboard.myRank);
