// convex/links.ts
// 6-digit join codes behind practify://join/<code> links (sent by the Keiki agent).
import { mutation, MutationCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Creates a joinLinks row with a unique 6-digit code and returns the code
export async function createJoinLink(ctx: MutationCtx, userId: Id<"users">, roomId: Id<"rooms">): Promise<string> {
  for (;;) {
    const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
    const taken = await ctx.db
      .query("joinLinks")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    if (taken) continue;
    await ctx.db.insert("joinLinks", { code, userId, roomId });
    return code;
  }
}

export const redeem = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const link = await ctx.db
      .query("joinLinks")
      .withIndex("by_code", (q) => q.eq("code", code.trim()))
      .first();
    if (!link) throw new ConvexError("That code doesn't match a room. Check the 6 digits and try again.");
    if (!link.used) await ctx.db.patch(link._id, { used: true });
    return { userId: link.userId, roomId: link.roomId };
  },
});
