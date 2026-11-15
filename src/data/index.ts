import { useMutation, useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";
import { useSyncExternalStore } from "react";

import { USE_FAKE_DATA } from "../config";
import * as feed from "../fake/feed";
import * as notifications from "../fake/notifications";
import * as rooms from "../fake/rooms";
import { getVersion, subscribe } from "../fake/store";
import * as summaries from "../fake/summaries";
import * as users from "../fake/users";
import { api } from "./api";
import type { Id } from "./types";

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

const useData = USE_FAKE_DATA ? useFakeQuery : useConvexQuery;
const useAction = USE_FAKE_DATA ? useFakeMutation : useConvexMutation;

const skipUnless = <A extends Args>(ready: unknown, args: A): A | "skip" => (ready ? args : "skip");

export const useOnboard = () => useAction(api.users.onboard, users.onboard);
export const useUser = (userId: Id | null) => useData(api.users.get, skipUnless(userId, { userId: userId! }), users.getUser);
export const useSetStance = () => useAction(api.users.setStance, users.setStance);

export const useFeed = (userId: Id | null, date: string) =>
  useData(api.feed.forUser, skipUnless(userId, { userId: userId!, date }), feed.forUser);
export const useTopicStats = (topicId: Id) => useData(api.dailyTopics.stats, { topicId }, feed.topicStats);

export const useNextRoom = (topicId: Id) => useData(api.rooms.next, { topicId }, rooms.nextRoom);
export const useJoinRoom = () => useAction(api.rooms.join, rooms.joinRoom);
export const useRoom = (roomId: Id) => useData(api.rooms.get, { roomId }, rooms.getRoom);
export const useRoomMessages = (roomId: Id) => useData(api.rooms.messages, { roomId }, rooms.roomMessages);
export const useSendMessage = () => useAction(api.rooms.send, rooms.sendMessage);
export const useLiveRooms = (topicId?: Id) => useData(api.rooms.live, topicId ? { topicId } : {}, rooms.liveRooms);

export const useRoomSummaries = (roomId: Id) => useData(api.summaries.forRoom, { roomId }, summaries.summariesForRoom);
export const useSubmitSummary = () => useAction(api.summaries.submit, summaries.submitSummary);
export const useGuessSummary = () => useAction(api.summaries.guess, summaries.guessSummary);
export const useRateSummary = () => useAction(api.summaries.rate, summaries.rateSummary);

export const useNotifications = (userId: Id | null) =>
  useData(api.notifications.mine, skipUnless(userId, { userId: userId! }), notifications.myNotifications);
export const useMarkRead = () => useAction(api.notifications.markRead, notifications.markRead);
