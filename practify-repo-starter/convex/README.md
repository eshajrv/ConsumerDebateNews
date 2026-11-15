# Practify backend (Convex)

5 minutes a day to really understand someone who sees the news differently.

## Setup

1. Copy the `convex/` folder into your app (Expo / React Native works well with Revyl).
2. Run `npx convex dev`. This links your Convex project and generates `convex/_generated/`.
3. Run `npm install supermemory` in the app project (the backend uses the Supermemory SDK).
   In the Convex dashboard, add environment variables `ANTHROPIC_API_KEY` and `SUPERMEMORY_API_KEY`.
   Optional for Keiki: `KEIKI_SHARED_SECRET` and `PRACTIFY_APP_LINK`.
4. Run `dailyTopics:generate` once from the dashboard with args `{ "force": true }`. It pulls
   today's news, has AI pick 4 topics, and publishes them. Check the logs: replace any feed that
   returned 0 headlines. After that it runs automatically at 6 AM Pacific (retry at 7 AM).

Login is first name only (`users:create`). Store the returned user ID on the phone.
Add real authentication before launch.

## Screen → function map

| Screen | Read (live queries) | Write (mutations) |
|---|---|---|
| Name entry | | `users.create` |
| Home: today's cards | `dailyTopics.today`, `dailyTopics.stats` (per card), `users.get` (streak, score) | |
| Topic: brief + slider | | `users.setStance` |
| Matching ("Finding someone…") | `matching.myActiveConversation` | `matching.findMatch`, `matching.cancel` |
| Chat | `conversations.get` (opener, timer via `endsAt`), `conversations.messages`, `conversations.reactions` | `conversations.send`, `conversations.endEarly` |
| Watch live (list) | `conversations.live` | |
| Spectate | `conversations.get`, `conversations.messages`, `conversations.reactions` | `conversations.react` |
| Here's what I heard: write | `conversations.get` (status = "summarizing") | `summaries.submit` |
| Here's what I heard: guess + rate | `summaries.forConversation` | `summaries.guess`, then `summaries.rate` |
| Spectator voting / big screen | `summaries.forConversation`, `summaries.voteResults` | `summaries.spectatorVote` |
| Admin: pull a bad topic | | `dailyTopics.hide` (from the dashboard) |

## How the main flow works

1. **Stance.** `setStance` saves a 0-100 position (0 = side A, 100 = side B) and updates the streak.
2. **Matching.** `findMatch` pairs you with the waiting person whose position is furthest from
   yours (at least 25 points apart). If nobody fits, you're added to the queue. The waiting
   screen subscribes to `myActiveConversation`, so it jumps to the chat the moment someone
   matches with you.
3. **Chat.** On match, AI writes an opener (`ai.generateOpener`) and a 5-minute timer starts.
   When time's up (or someone ends early), status becomes `summarizing` and AI rates how
   constructive each person was (`ai.rateCivility`), nudging their good-faith score.
4. **Here's what I heard.** Each person writes one sentence about the other's view, starting
   with "You…". AI writes its own version in the same style (`ai.writeAiSummary`). The person
   being summarized sees both in random order, guesses which is human, sees the reveal, then
   rates "Did they get you?" (1-5).
5. **Scoring.** Points = rating × 10, plus 20 if they couldn't tell your summary from the AI's.
   Good ratings raise the author's good-faith score. The conversation is `done` once both
   summaries are rated.

## Sponsor stack

| Tool | Where it lives | What it does in Practify |
|---|---|---|
| Convex | everything in `convex/` | Database, live updates, matching, chat, scheduled AI jobs, news pipeline |
| Revyl | the phone app | Builds, tests and runs the Expo app on a real phone for the demo |
| Capy | the team's workflow | Writes the screens and fixes |
| Supermemory | `convex/memory.ts` | Remembers each person's views and how well they listen; writes the personal insight on Results (`users.get` returns `insight`) |
| Keiki | `convex/http.ts` + Keiki dashboard | A Practify agent over iMessage/SMS that texts the morning topics and live numbers, with a link into the app |

### Keiki agent setup (no app code needed)

1. In Keiki, create an agent called Practify.
2. Add two HTTP tools pointing at your Convex site URL (ends in `.convex.site`):
   `GET /keiki/today` (today's topics with live numbers) and `GET /keiki/topic?id=...` (one topic's brief).
   If you set `KEIKI_SHARED_SECRET`, send it as the header `x-practify-key`.
3. Instructions for the agent: "You are Practify. Each morning, text the user today's topics as a short list
   with how people are split. If they ask about one, give the brief and both sides fairly, never take a
   side, then send the link so they can talk to someone who sees it differently in the app."
4. Turn on iMessage or SMS. Ask the Keiki team on the floor for help with channel setup.

## Demo tips

- Seed one topic for the room, like "Should startups let AI write most of their code?"
- Test matching with 10+ phones before the demo.
- The big screen can show the spectate view plus `summaries.voteResults` live.
