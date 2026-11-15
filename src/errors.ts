import { ConvexError } from "convex/values";

export const errorMessage = (e: unknown, fallback: string) =>
  e instanceof ConvexError && typeof e.data === "string" ? e.data : fallback;
