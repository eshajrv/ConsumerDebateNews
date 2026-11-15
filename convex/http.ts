// convex/http.ts
// Public HTTP endpoints for the Keiki agent (Practify by text: iMessage, SMS, WhatsApp).
// Keiki calls these as tools so the agent can text people today's topics and live numbers.
// Your endpoint base URL is in the Convex dashboard (Settings > URL & Deploy Key), ending in .convex.site
//
//   GET  /keiki/today            -> today's topics with live split and "talking now"
//   GET  /keiki/topic?id=<id>    -> one topic's full brief and both sides
//   POST /keiki/user             { phone, name? }          -> { userId, isNew }
//   GET  /keiki/feed?phone=      -> the user's 4 topics (shared first) with live split
//   POST /keiki/take             { phone, topicId, text }  -> { status: "saved", position, take } | { status: "unclear", followUp }
//   POST /keiki/join             { phone, topicId }        -> { roomId, slot, link, code }
//   GET  /join?code=<code>       -> public HTML page showing the room code and an "Open Practify" button
//
// Every endpoint requires the header "x-practify-key" to equal KEIKI_SHARED_SECRET (set in Convex
// and synced to Keiki). The phone is always the texter's own number; no other number is ever returned.
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { normalizePhone } from "./users";
import { askClaude, extractJson } from "./lib/claude";

const http = httpRouter();

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const authorized = (req: Request) => {
  const secret = process.env.KEIKI_SHARED_SECRET;
  return !!secret && req.headers.get("x-practify-key") === secret;
};

// Parses a JSON object body; null if it isn't one
const readBody = async (req: Request): Promise<Record<string, unknown> | null> => {
  try {
    const body: unknown = await req.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

const str = (x: unknown) => (typeof x === "string" && x.trim() ? x.trim() : null);

const pacificDate = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

// Link the agent sends so people can jump into the app (replace with your Expo link)
const APP_LINK = process.env.PRACTIFY_APP_LINK ?? "https://practify.app";

http.route({
  path: "/keiki/today",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    if (!authorized(req)) return json({ error: "unauthorized" }, 401);
    const topics = await ctx.runQuery(api.dailyTopics.today, { date: pacificDate() });
    const withStats = await Promise.all(
      topics.map(async (t) => {
        const s = await ctx.runQuery(api.dailyTopics.stats, { topicId: t._id });
        return {
          id: t._id,
          category: t.category,
          question: t.question,
          sideA: t.sideA,
          sideB: t.sideB,
          peopleAnswered: s.total,
          leaningA: s.leanA,
          leaningB: s.leanB,
          talkingNow: s.talkingNow,
          link: `${APP_LINK}/topic/${t._id}`,
        };
      }),
    );
    return json({ date: pacificDate(), topics: withStats });
  }),
});

http.route({
  path: "/keiki/topic",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    if (!authorized(req)) return json({ error: "unauthorized" }, 401);
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return json({ error: "missing id" }, 400);
    const topics = await ctx.runQuery(api.dailyTopics.today, { date: pacificDate() });
    const t = topics.find((x) => x._id === (id as Id<"topics">));
    if (!t) return json({ error: "topic not found today" }, 404);
    return json({
      id: t._id,
      question: t.question,
      brief: t.brief,
      sideA: t.sideA,
      sideAView: t.sideAView,
      sideB: t.sideB,
      sideBView: t.sideBView,
      sources: t.sources,
      link: `${APP_LINK}/topic/${t._id}`,
    });
  }),
});

http.route({
  path: "/keiki/user",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if (!authorized(req)) return json({ error: "unauthorized" }, 401);
    const body = await readBody(req);
    const phone = body && str(body.phone) && normalizePhone(str(body.phone)!);
    if (!body || !phone) return json({ error: "phone is required" }, 400);
    if (body.name !== undefined && body.name !== null && typeof body.name !== "string") {
      return json({ error: "name must be a string" }, 400);
    }
    const name = str(body.name) ?? undefined;
    return json(await ctx.runMutation(internal.users.upsertByPhone, { phone, name }));
  }),
});

http.route({
  path: "/keiki/feed",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    if (!authorized(req)) return json({ error: "unauthorized" }, 401);
    const raw = new URL(req.url).searchParams.get("phone");
    const phone = raw && normalizePhone(raw);
    if (!phone) return json({ error: "phone is required" }, 400);
    const feed = await ctx.runQuery(internal.keiki.feed, { phone });
    if (!feed) return json({ error: "user not found" }, 404);
    return json({
      date: feed.date,
      topics: feed.topics,
    });
  }),
});

const NUMBER_TAKE = /^\s*(\d{1,3}(?:\.\d+)?)\s*%?\s*$/;

http.route({
  path: "/keiki/take",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if (!authorized(req)) return json({ error: "unauthorized" }, 401);
    const body = await readBody(req);
    const phone = body && str(body.phone) && normalizePhone(str(body.phone)!);
    const topicId = body && str(body.topicId);
    const text = body && str(body.text);
    if (!phone || !topicId || !text) return json({ error: "phone, topicId and text are required" }, 400);
    if (text.length > 1000) return json({ error: "text is too long" }, 400);

    const c = await ctx.runQuery(internal.keiki.takeContext, { phone, topicId });
    if (!c) return json({ error: "user or topic not found" }, 404);

    const fallback = {
      status: "unclear",
      followUp: `Where would you put yourself from 0 to 100, where 0 is "${c.sideA}" and 100 is "${c.sideB}"? Or just tell me which side you lean toward.`,
    };

    let position: number | null = null;
    const n = text.match(NUMBER_TAKE);
    if (n && Number(n[1]) <= 100) {
      position = Number(n[1]);
    } else {
      const prompt = `Someone was asked about this question: "${c.question}"
Side A (0): "${c.sideA}"
Side B (100): "${c.sideB}"

Their answer, in their own words: "${text}"

Place their view on a 0-100 scale (0 = fully side A, 50 = in the middle or genuinely torn, 100 = fully side B).
If you can't tell where they stand, set position to null and write ONE short, friendly, neutral follow-up
question that would help them say where they lean. Never suggest which side is right.
Return ONLY JSON: {"position": number | null, "followUp": string | null}`;
      try {
        const r = extractJson<{ position: number | null; followUp: string | null }>(await askClaude(prompt, 150));
        if (typeof r.position === "number" && r.position >= 0 && r.position <= 100) {
          position = r.position;
        } else {
          return json({ status: "unclear", followUp: r.followUp?.trim() || fallback.followUp });
        }
      } catch (e) {
        console.log("keiki/take: AI failed; asking for a number", e);
        return json(fallback);
      }
    }

    const saved = await ctx.runMutation(internal.keiki.saveTake, {
      userId: c.userId,
      topicId: c.topicId,
      position,
      take: text,
    });
    return json({ status: "saved", position: saved, take: text });
  }),
});

http.route({
  path: "/keiki/join",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if (!authorized(req)) return json({ error: "unauthorized" }, 401);
    const body = await readBody(req);
    const phone = body && str(body.phone) && normalizePhone(str(body.phone)!);
    const topicId = body && str(body.topicId);
    if (!phone || !topicId) return json({ error: "phone and topicId are required" }, 400);
    const r = await ctx.runMutation(internal.keiki.join, { phone, topicId });
    if ("error" in r)
      return json({ error: r.error }, r.error === "user not found" || r.error === "topic not found" ? 404 : 400);
    const link = `${process.env.CONVEX_SITE_URL}/join?code=${r.code}`;
    return json({ roomId: r.roomId, slot: r.slot, link, code: r.code });
  }),
});

// Public page behind the join links Keiki texts out (Messages can't open practify:// links directly)
const joinPage = (code: string | null) => {
  const body = code
    ? `<p class="label">Your Practify room code</p>
    <p class="code">${code}</p>
    <p>Open the Practify app and enter this code</p>
    <a class="button" href="practify://join/${code}">Open Practify</a>`
    : `<p>This link is missing a code.</p>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Practify room code</title>
<style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: #fff; color: #1f2933; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    text-align: center; }
  main { padding: 32px 24px; max-width: 420px; }
  p { font-size: 17px; line-height: 1.5; margin: 0 0 16px; }
  .label { color: #52606d; }
  .code { font-size: 56px; font-weight: 700; letter-spacing: 8px; margin: 8px 0 24px; color: #3b5bdb; }
  .button { display: inline-block; margin-top: 8px; padding: 16px 32px; border-radius: 16px; background: #3b5bdb;
    color: #fff; font-size: 17px; font-weight: 600; text-decoration: none; }
</style>
</head>
<body><main>${body}</main></body>
</html>`;
};

http.route({
  path: "/join",
  method: "GET",
  handler: httpAction(async (_ctx, req) => {
    const raw = new URL(req.url).searchParams.get("code")?.trim() ?? "";
    const code = /^\d{6}$/.test(raw) ? raw : null;
    return new Response(joinPage(code), {
      status: code ? 200 : 400,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }),
});

export default http;
