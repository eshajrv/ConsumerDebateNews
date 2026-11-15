// convex/http.ts
// Public HTTP endpoints for the Keiki agent (Practify by text: iMessage, SMS, WhatsApp).
// Keiki calls these as tools so the agent can text people today's topics and live numbers.
// Your endpoint base URL is in the Convex dashboard (Settings > URL & Deploy Key), ending in .convex.site
//
//   GET /keiki/today            -> today's topics with live split and "talking now"
//   GET /keiki/topic?id=<id>    -> one topic's full brief and both sides
//
// Optional protection: set KEIKI_SHARED_SECRET in Convex and send it from Keiki as the
// header "x-practify-key".
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

const http = httpRouter();

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const authorized = (req: Request) => {
  const secret = process.env.KEIKI_SHARED_SECRET;
  return !secret || req.headers.get("x-practify-key") === secret;
};

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
      })
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

export default http;
