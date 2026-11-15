// convex/stats.ts
// The pitch number: how many of today's room members changed their mind.
import { query } from "./_generated/server";
import { v } from "convex/values";

const MOVED = 10; // a shift of 10+ points counts as a changed mind

// stats.today({ date }): of today's room members whose room has ended, how many ended up
// 10+ points from where they started. "End" is their slider answer if they gave one,
// otherwise the AI estimate. Members with neither aren't counted.
// `date` is "YYYY-MM-DD" Pacific, passed by the client (queries don't read the clock).
export const today = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    const topics = await ctx.db
      .query("topics")
      .withIndex("by_date_status", (q) => q.eq("date", date))
      .collect();

    let members = 0;
    let measured = 0;
    let moved = 0;
    let fromSlider = 0;
    let rooms = 0;
    for (const topic of topics) {
      const topicRooms = await ctx.db
        .query("rooms")
        .withIndex("by_topic_and_slotStart", (q) => q.eq("topicId", topic._id))
        .collect();
      for (const room of topicRooms) {
        if (room.status !== "summarizing" && room.status !== "done") continue;
        rooms++;
        const roomMembers = await ctx.db
          .query("roomMembers")
          .withIndex("by_room", (q) => q.eq("roomId", room._id))
          .collect();
        for (const m of roomMembers) {
          if (m.left) continue;
          members++;
          const end = m.positionAfter ?? m.endPositionAI;
          if (end === undefined) continue;
          measured++;
          if (m.positionAfter !== undefined) fromSlider++;
          if (Math.abs(end - m.position) >= MOVED) moved++;
        }
      }
    }
    return {
      date,
      percentMoved: measured ? Math.round((moved / measured) * 100) : 0,
      moved,
      measured, // members with a slider answer or AI estimate
      members, // everyone in today's finished rooms
      fromSlider,
      rooms,
    };
  },
});
