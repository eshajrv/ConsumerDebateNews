// convex/dailyTopics.ts
// Automatic daily topics. Every morning:
//   1. Pull headlines from news RSS feeds across the spectrum
//   2. AI groups them into stories and keeps the ones people genuinely disagree on
//   3. AI writes each topic card (question, two sides, neutral brief, sources) and marks one
//      as the shared topic of the day
//   4. Topics publish automatically. If the run fails, the app keeps showing the last good set.
// Run it by hand any time from the Convex dashboard: dailyTopics:generate (args: { "force": true }).
import { internalAction, internalMutation, internalQuery, mutation, query, QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { askClaude, extractJson } from "./lib/claude";

// Feeds and their lean. Leans are approximate: check each outlet on allsides.com/media-bias.
// Any feed that fails is logged and skipped, so one broken URL never stops the run.
// After the first run, check the logs and replace any feed that returned 0 headlines.
const FEEDS: { name: string; url: string; lean: "left" | "center" | "right" }[] = [
  { name: "NPR", url: "https://feeds.npr.org/1001/rss.xml", lean: "left" },
  { name: "The Guardian US", url: "https://www.theguardian.com/us-news/rss", lean: "left" },
  { name: "New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml", lean: "left" },
  { name: "BBC News", url: "https://feeds.bbci.co.uk/news/rss.xml", lean: "center" },
  { name: "The Hill", url: "https://thehill.com/feed/", lean: "center" },
  { name: "TechCrunch", url: "https://techcrunch.com/feed/", lean: "center" },
  { name: "The Verge", url: "https://www.theverge.com/rss/index.xml", lean: "center" },
  { name: "Fox News", url: "https://moxie.foxnews.com/google-publisher/latest.xml", lean: "right" },
  { name: "New York Post", url: "https://nypost.com/feed/", lean: "right" },
  { name: "Washington Examiner", url: "https://www.washingtonexaminer.com/feed", lean: "right" },
  // Sports
  { name: "CBS Sports", url: "https://www.cbssports.com/rss/headlines/", lean: "center" },
  { name: "Yahoo Sports", url: "https://sports.yahoo.com/rss/", lean: "center" },
  { name: "Fox Sports News", url: "https://moxie.foxnews.com/google-publisher/sports.xml", lean: "right" },
  // Campus
  { name: "NPR Education", url: "https://feeds.npr.org/1013/rss.xml", lean: "left" },
  { name: "Inside Higher Ed", url: "https://www.insidehighered.com/rss.xml", lean: "center" },
  { name: "The Hechinger Report", url: "https://hechingerreport.org/feed/", lean: "center" },
  { name: "The College Fix", url: "https://www.thecollegefix.com/feed/", lean: "right" },
];

const CATEGORIES = ["politics", "tech", "culture", "sports", "campus"];
const TOPICS_PER_DAY = 10; // 2 per category when the news allows
const HEADLINES_PER_FEED = 15;

type Headline = { outlet: string; lean: string; title: string; description: string; link: string };

// Today's date in Pacific time, so "today" matches the users' phones.
export function pacificDate(d = new Date()): string {
  return d.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

function parseRss(xml: string, outlet: string, lean: string): Headline[] {
  // Handles both RSS (<item>) and Atom (<entry>) feeds
  const parts = xml.includes("<item") ? xml.split(/<item[\s>]/) : xml.split(/<entry[\s>]/);
  const clean = (s: string) =>
    s
      .replace(/<!\[CDATA\[|\]\]>/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;|&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
  const pick = (s: string, tag: string) =>
    clean(s.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1] ?? "");
  const link = (s: string) =>
    pick(s, "link") || (s.match(/<link[^>]*href="([^"]+)"/)?.[1] ?? "");
  return parts
    .slice(1, HEADLINES_PER_FEED + 1)
    .map((it) => ({
      outlet,
      lean,
      title: pick(it, "title"),
      description: (pick(it, "description") || pick(it, "summary")).slice(0, 280),
      link: link(it),
    }))
    .filter((h) => h.title.length > 0);
}

const PROMPT = (headlines: Headline[], recentQuestions: string[]) => `
You choose today's discussion topics for Practify, an app that puts small groups of people who
see the news differently into a short, respectful 10-minute conversation.

Today's headlines, labeled with outlet and approximate political lean:
${JSON.stringify(headlines)}

Questions used in the last few days (do not repeat these or near-duplicates):
${JSON.stringify(recentQuestions)}

Steps:
1. Group headlines that cover the same story.
2. Keep a story only if it passes ALL of these:
   - Real sides: reasonable people genuinely land on both sides.
   - It can be a clear yes/no or A-vs-B question.
   - No side would have to defend something hateful or attack a group of people.
   - Not a tragedy, disaster, crime, or death.
   - A regular person can discuss it for 10 minutes without being an expert.
   - Politics stories: covered by at least one left AND one right outlet.
     Tech, culture, sports and campus stories: covered by at least two outlets.
3. Pick exactly ${TOPICS_PER_DAY}: 2 politics, 2 tech, 2 culture, 2 sports, 2 campus. If there
   aren't enough of a category, fill with the best remaining stories of another category.
4. Mark exactly ONE topic as the shared topic of the day: the one most people would find
   interesting and have an opinion on, whatever their interests.

For each, write in your own words (never copy article text, never invent facts or numbers):
- category: "politics" | "tech" | "culture" | "sports" | "campus"
- question: the yes/no or A-vs-B question, under 90 characters
- sideA, sideB: short labels for each side, 2-5 words each
- brief: 3-4 neutral sentences: what happened and why people disagree
- sideAView, sideBView: one sentence each, the strongest fair version of that side
- sources: 2-4 links from the headlines above, from different outlets when possible
- isShared: true for the one shared topic, false for the rest

Return ONLY a JSON array of ${TOPICS_PER_DAY} objects with exactly those fields.`;

type TopicDraft = {
  category: string;
  question: string;
  sideA: string;
  sideB: string;
  brief: string;
  sideAView: string;
  sideBView: string;
  sources: string[];
  isShared?: boolean;
};

function validTopic(t: TopicDraft): boolean {
  return (
    CATEGORIES.includes(t.category) &&
    typeof t.question === "string" && t.question.length > 10 && t.question.length < 140 &&
    !!t.sideA && !!t.sideB && !!t.brief && !!t.sideAView && !!t.sideBView &&
    Array.isArray(t.sources)
  );
}

export const generate = internalAction({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, { force }) => {
    const date = pacificDate();
    const existing = await ctx.runQuery(internal.dailyTopics.forDate, { date });
    if (existing.length > 0 && !force) {
      console.log(`Topics for ${date} already exist; pass { force: true } to regenerate`);
      return;
    }

    // 1. Collect headlines (all feeds in parallel)
    const results = await Promise.all(
      FEEDS.map(async (f) => {
        try {
          const res = await fetch(f.url, { headers: { "user-agent": "Practify/1.0 (news topics)" } });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const items = parseRss(await res.text(), f.name, f.lean);
          console.log(`${f.name}: ${items.length} headlines`);
          return items;
        } catch (e) {
          console.log(`${f.name}: FAILED (${(e as Error).message})`);
          return [];
        }
      })
    );
    const headlines = results.flat();
    const leans = new Set(headlines.map((h) => h.lean));
    if (headlines.length < 20 || leans.size < 2) {
      console.log(`Not enough headlines (${headlines.length}, leans: ${[...leans]}); keeping the last topics`);
      return;
    }

    // 2-3. AI picks and writes the topics (one retry if the output is malformed)
    const recentQuestions = await ctx.runQuery(internal.dailyTopics.recentQuestions, {});
    let topics: TopicDraft[] = [];
    for (let attempt = 1; attempt <= 2 && topics.length < TOPICS_PER_DAY; attempt++) {
      try {
        const raw = await askClaude(PROMPT(headlines, recentQuestions), 8000);
        topics = extractJson<TopicDraft[]>(raw).filter(validTopic).slice(0, TOPICS_PER_DAY);
      } catch (e) {
        console.log(`Attempt ${attempt} failed: ${(e as Error).message}`);
      }
    }
    if (topics.length === 0) {
      console.log("AI returned no valid topics; keeping the last topics");
      return;
    }

    // Exactly one shared topic: the AI's pick, or the first topic if it didn't pick one
    const sharedIndex = Math.max(0, topics.findIndex((t) => t.isShared === true));
    const cards = topics.map((t, i) => ({
      category: t.category,
      question: t.question,
      sideA: t.sideA,
      sideB: t.sideB,
      brief: t.brief,
      sideAView: t.sideAView,
      sideBView: t.sideBView,
      sources: t.sources.filter((s) => typeof s === "string"),
      isShared: i === sharedIndex,
    }));

    // 4. Publish (replaces today's set if forced)
    await ctx.runMutation(internal.dailyTopics.publishDay, { date, topics: cards });
    console.log(`Published ${topics.length} topics for ${date}`);
  },
});

export const forDate = internalQuery({
  args: { date: v.string() },
  handler: async (ctx, { date }) =>
    ctx.db
      .query("topics")
      .withIndex("by_date_status", (q) => q.eq("date", date).eq("status", "live"))
      .collect(),
});

export const recentQuestions = internalQuery({
  args: {},
  handler: async (ctx) => {
    const recent = await ctx.db.query("topics").order("desc").take(30);
    return recent.map((t) => t.question);
  },
});

const topicFields = {
  category: v.string(),
  question: v.string(),
  sideA: v.string(),
  sideB: v.string(),
  brief: v.string(),
  sideAView: v.string(),
  sideBView: v.string(),
  sources: v.array(v.string()),
  isShared: v.boolean(),
};

export const publishDay = internalMutation({
  args: { date: v.string(), topics: v.array(v.object(topicFields)) },
  handler: async (ctx, { date, topics }) => {
    // Retire any earlier set for this date (keeps old conversations' topics intact)
    const old = await ctx.db
      .query("topics")
      .withIndex("by_date_status", (q) => q.eq("date", date).eq("status", "live"))
      .collect();
    for (const t of old) await ctx.db.patch(t._id, { status: "replaced" });
    for (const t of topics) await ctx.db.insert("topics", { ...t, date, status: "live" });
  },
});

// Optional safety valve: hide a topic that slipped through (e.g. from the dashboard).
export const hide = mutation({
  args: { id: v.id("topics") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { status: "hidden" });
  },
});

// Today's live topics. If today's run hasn't happened or failed,
// fall back to the most recent day that has topics, so the app is never empty.
export async function liveTopics(ctx: QueryCtx, date: string) {
  const todays = await ctx.db
    .query("topics")
    .withIndex("by_date_status", (q) => q.eq("date", date).eq("status", "live"))
    .collect();
  if (todays.length > 0) return todays;
  const recent = await ctx.db.query("topics").order("desc").take(50);
  const latestLive = recent.find((t) => t.status === "live");
  if (!latestLive) return [];
  return recent.filter((t) => t.status === "live" && t.date === latestLive.date);
}

// Home screen: today's topics.
export const today = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => liveTopics(ctx, date),
});

// Live numbers on each card: how people split, and how many are talking right now.
export const stats = query({
  args: { topicId: v.id("topics") },
  handler: async (ctx, { topicId }) => {
    const stances = await ctx.db
      .query("stances")
      .withIndex("by_topic", (q) => q.eq("topicId", topicId))
      .collect();
    const leanA = stances.filter((s) => s.position < 50).length;
    const live = await ctx.db
      .query("conversations")
      .withIndex("by_topic_status", (q) => q.eq("topicId", topicId).eq("status", "live"))
      .collect();
    return {
      total: stances.length,
      leanA,
      leanB: stances.length - leanA,
      talkingNow: live.length * 2,
    };
  },
});
