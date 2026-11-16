# speak-easy

**AI agrees with you. People make you think.**

Every morning speak-easy gives you four news stories: the *house table* everyone shares,
two things you want to learn about, and one you'd never pick yourself. Personal in what it
covers, never in what it tells you to think. Share your take, then pull up a chair at a
table with people who see it differently: 1-on-1, or a group of up to six that always
includes someone in the middle. An AI host keeps it fair, and you're scored on how well
you understood someone, not on winning.

Built in one day at the YC Consumer Mobile Hackathon with **Convex, Capy, Revyl,
Supermemory and Keiki**.

## How it works

1. **Profile:** what you know a lot about, what you want to learn, and whether we reach you
   in the app or by text.
2. **Morning feed:** 4 topics with a neutral brief and both sides at their strongest, in the
   app or as a photo carousel over text (Keiki agent).
3. **Your take:** a slider in the app, or your own words by text (AI turns them into a
   0-100 position).
4. **The table:** a 5-minute live chat. The AI host opens with common ground, nudges quiet
   people, flags personal attacks, and notices when someone's view starts to shift. You're
   told whose view to listen for.
5. **Where do you stand now?** Everyone moves their slider again; the AI also estimates
   where each person ended up.
6. **Here's what I heard:** you sum up your assigned person's view in one sentence; the AI
   writes one too. They guess which is yours and rate "Did they get you?" 1-5. Points =
   rating x 10, +20 if they couldn't tell yours from the AI's.
7. **Results and memory:** "You moved N points toward ..." plus a personal insight from
   Supermemory, which also reshapes your next feed.
8. **At the bar:** watch the featured live table; a daily leaderboard for the best listeners.

The headline metric is `stats.today`: the percent of people at today's tables whose view
moved 10+ points.

## Stack

| | What it does here |
|---|---|
| **Convex** (`convex/`) | Database, live queries (seats, chat, host messages update on every phone), scheduled jobs (slots, host checks, daily news pipeline), HTTP endpoints for Keiki |
| **Expo + Revyl** (`app/`, `src/`) | The phone app, built and run on real iPhones through Revyl |
| **Keiki** (`keiki/`) | The texting agent: morning feed carousel, takes by text, join links |
| **Supermemory** (`convex/memory.ts`) | Remembers how each person listens and how their views move; writes the insight and ranks the feed |
| **Capy** | Wrote most of the code through small, one-task pull requests |
| **OpenAI** (`convex/lib/claude.ts`) | Topic writing, the AI host, AI summaries, position estimates |

## Run it

```
npm install
npx convex dev          # backend; deploys convex/ to your dev deployment
npx expo start          # app (or: revyl dev --profile development --platform ios)
```

Convex environment variables: `OPENAI_API_KEY`, `SUPERMEMORY_API_KEY`,
`KEIKI_SHARED_SECRET`, `SLOT_MINUTES` (2 for demos), and optionally `KEIKI_SEND_URL`.
The app reads `EXPO_PUBLIC_CONVEX_URL` from `.env`. Keiki setup is in `keiki/README.md`.

Useful commands:

```
npx convex run dailyTopics:generate '{"force": true}'   # make today's topics now
npx convex run memory:selfTest                          # check Supermemory end to end
npx convex run admin:resetTables '{"confirm":"RESET"}'  # clean slate for a demo
```

- `PLAN.md`: the product spec and build plan
- `AGENTS.md`: rules for Capy and other coding agents
