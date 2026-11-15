/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as conversations from "../conversations.js";
import type * as crons from "../crons.js";
import type * as dailyTopics from "../dailyTopics.js";
import type * as feed from "../feed.js";
import type * as http from "../http.js";
import type * as keiki from "../keiki.js";
import type * as lib_claude from "../lib/claude.js";
import type * as links from "../links.js";
import type * as matching from "../matching.js";
import type * as memory from "../memory.js";
import type * as notify from "../notify.js";
import type * as rooms from "../rooms.js";
import type * as summaries from "../summaries.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  conversations: typeof conversations;
  crons: typeof crons;
  dailyTopics: typeof dailyTopics;
  feed: typeof feed;
  http: typeof http;
  keiki: typeof keiki;
  "lib/claude": typeof lib_claude;
  links: typeof links;
  matching: typeof matching;
  memory: typeof memory;
  notify: typeof notify;
  rooms: typeof rooms;
  summaries: typeof summaries;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
