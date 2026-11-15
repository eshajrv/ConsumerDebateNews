// convex/notify.ts
// Sends a notification to a user. For now this only writes to the in-app inbox
// (the notifications table). Task 5 will route "text" users through Keiki.
import { MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export async function notify(ctx: MutationCtx, userId: Id<"users">, message: string, link?: string) {
  await ctx.db.insert("notifications", { userId, message, link, read: false });
}
