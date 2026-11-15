// convex/crons.ts
// Runs the daily topics pipeline every morning.
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// 6:00 AM Pacific in winter = 14:00 UTC (13:00 UTC during daylight saving time)
crons.daily(
  "generate daily topics",
  { hourUTC: 14, minuteUTC: 0 },
  internal.dailyTopics.generate,
  {}
);

// Safety retry at 7:00 AM Pacific: does nothing if 6 AM already published today's topics
crons.daily(
  "retry daily topics",
  { hourUTC: 15, minuteUTC: 0 },
  internal.dailyTopics.generate,
  {}
);

export default crons;
