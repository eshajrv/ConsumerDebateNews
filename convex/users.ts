// convex/users.ts
// Simple users (first name only for the hackathon; add real auth later).
import { internalMutation, mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { Id } from "./_generated/dataModel";

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) =>
    ctx.db.insert("users", { name: name.trim().slice(0, 30), goodFaithScore: 50, streak: 0 }),
});

// E.164: "+1XXXXXXXXXX" for 10-digit US numbers. Returns null if it doesn't look like a phone number.
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (raw.trim().startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export async function userByPhone(ctx: QueryCtx, phone: string) {
  return ctx.db
    .query("users")
    .withIndex("by_phone", (q) => q.eq("phone", phone))
    .first();
}

export const onboard = mutation({
  args: {
    name: v.string(),
    interests: v.array(v.string()),
    notifyVia: v.union(v.literal("app"), v.literal("text")),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim().slice(0, 30);
    if (!name) throw new ConvexError("Please enter your first name");
    const interests = [...new Set(args.interests.map((i) => i.trim().toLowerCase()).filter((i) => i))];

    let phone: string | undefined;
    if (args.phone?.trim()) {
      phone = normalizePhone(args.phone) ?? undefined;
      if (!phone) throw new ConvexError("That phone number doesn't look right");
    }
    if (args.notifyVia === "text" && !phone) throw new ConvexError("Add your phone number to get texts");

    if (phone) {
      const existing = await userByPhone(ctx, phone);
      if (existing) {
        await ctx.db.patch(existing._id, { name, interests, notifyVia: args.notifyVia });
        return existing._id;
      }
    }
    return ctx.db.insert("users", {
      name,
      interests,
      notifyVia: args.notifyVia,
      phone,
      goodFaithScore: 50,
      streak: 0,
      totalPoints: 0,
    });
  },
});

// Keiki: find or create the user texting from `phone` (already E.164)
export const upsertByPhone = internalMutation({
  args: { phone: v.string(), name: v.optional(v.string()) },
  handler: async (ctx, { phone, name }) => {
    const clean = name?.trim().slice(0, 30);
    const existing = await userByPhone(ctx, phone);
    if (existing) {
      if (clean) await ctx.db.patch(existing._id, { name: clean });
      return { userId: existing._id, isNew: false };
    }
    const userId = await ctx.db.insert("users", {
      name: clean || "Friend",
      phone,
      notifyVia: "text",
      goodFaithScore: 50,
      streak: 0,
      totalPoints: 0,
    });
    return { userId, isNew: true };
  },
});

export const get = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) return null;
    const { phone: _phone, ...rest } = user;
    return rest;
  },
});

// Saves a 0-100 position and updates the daily streak. Shared by setStance and Keiki takes.
export async function saveStance(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    topicId: Id<"topics">;
    position: number;
    today: string;
    take?: string;
    source?: "app" | "text";
  },
) {
  const { userId, topicId, today } = args;
  const pos = Math.max(0, Math.min(100, Math.round(args.position)));
  const fields = {
    position: pos,
    ...(args.take !== undefined && { take: args.take }),
    ...(args.source !== undefined && { source: args.source }),
  };
  const existing = await ctx.db
    .query("stances")
    .withIndex("by_user_topic", (q) => q.eq("userId", userId).eq("topicId", topicId))
    .unique();
  if (existing) await ctx.db.patch(existing._id, fields);
  else await ctx.db.insert("stances", { userId, topicId, ...fields });

  const user = await ctx.db.get(userId);
  if (!user) throw new ConvexError("We couldn't find your account. Try signing up again.");
  if (user.lastActiveDate !== today) {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    const yesterday = d.toISOString().slice(0, 10);
    await ctx.db.patch(userId, {
      streak: user.lastActiveDate === yesterday ? user.streak + 1 : 1,
      lastActiveDate: today,
    });
  }
  return pos;
}

// Save where the user stands on a topic, and update their daily streak.
// `today` comes from the phone so the streak follows the user's local date.
export const setStance = mutation({
  args: {
    userId: v.id("users"),
    topicId: v.id("topics"),
    position: v.number(),
    today: v.string(), // "YYYY-MM-DD"
  },
  handler: async (ctx, args) => {
    await saveStance(ctx, args);
  },
});
