// convex/notify.ts
// Sends a notification to a user, routed by users.notifyVia:
//   "app"  -> the in-app inbox (notifications table)
//   "text" -> the inbox too, plus a text through Keiki (sendText)
import { internalAction, MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

export async function notify(ctx: MutationCtx, userId: Id<"users">, message: string, link?: string) {
  await ctx.db.insert("notifications", { userId, message, link, read: false });
  const user = await ctx.db.get(userId);
  if (user?.notifyVia === "text" && user.phone) {
    await ctx.scheduler.runAfter(0, internal.notify.sendText, { phone: user.phone, message, link });
  }
}

// POSTs { phone, message, link } to KEIKI_SEND_URL. Never throws: a failed text is only logged.
export const sendText = internalAction({
  args: { phone: v.string(), message: v.string(), link: v.optional(v.string()) },
  handler: async (_ctx, { phone, message, link }) => {
    const url = process.env.KEIKI_SEND_URL;
    if (!url) {
      console.log(`sendText (KEIKI_SEND_URL unset): ${message}${link ? ` ${link}` : ""}`);
      return;
    }
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-practify-key": process.env.KEIKI_SHARED_SECRET ?? "",
        },
        body: JSON.stringify({ phone, message, link }),
      });
      if (!res.ok) console.log(`sendText failed: ${res.status} ${await res.text()}`);
    } catch (e) {
      console.log(`sendText failed: ${(e as Error).message}`);
    }
  },
});
