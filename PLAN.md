# Practify: product spec and build plan

The team's living plan (with diagrams) is a shared doc; this file is the version for
coding agents. If they disagree, ask a human.

## The product

Every morning Practify gives you a short news feed that's personal in what it covers
but never in what it tells you to think. You share your take, then join a room of up
to 6 people spread across the opinion scale, for a 10-minute group chat with an AI
judge in the middle. You're scored on how well you understood someone, not on winning.
You choose how Practify reaches you: in the app (inbox) or by text (Keiki agent).

### One person's day

1. 6 AM: the news pipeline reads 10 outlets and picks 10 topics (politics, tech,
   culture, sports, campus). One is the shared topic of the day.
2. Your feed: the shared topic + 3 picked for you. Every topic has a neutral brief
   and both sides at their strongest.
3. 8 AM: a nudge in the app inbox, or a text from Keiki.
4. Your take: a slider in the app, or your own words by text (AI turns them into a
   0-100 position).
5. Join a room: each topic has a room every SLOT_MINUTES (15 in real life, 2 for the
   demo). Up to 6 people, mixed across the scale.
6. 10-minute group chat. The AI judge opens, nudges quiet people, flags personal
   attacks, and closes with where the group agreed.
7. Here's what I heard: each person summarizes one assigned person (a circle). The
   summarized person guesses which of two summaries a human wrote (one is AI) and
   rates "Did they get you?" 1-5. Points go to the leaderboard.
8. Results arrive the way you chose. Supermemory remembers what you engage with and
   how you listen, which shapes tomorrow's feed.

## Core rules

- Personalization chooses which topics you see, never which side. Never use a
  user's positions to rank their feed.
- No phone numbers are ever shared between users.
- The AI judge never takes a side and never speaks for a person.
- Rooms are mixed on purpose (see Rooms). A one-sided room never starts.

## Feed

- `dailyTopics.generate` (cron 6 AM Pacific, retry 7 AM): 10 topics, exactly one with
  `isShared: true`. Each topic: category, question, sideA, sideB, brief, sideAView,
  sideBView, sources. Politics topics must be covered by at least one left and one
  right outlet; tech/culture/sports/campus by at least two outlets.
- `feed.forUser({userId, date})`: the shared topic first, then the top 3 of the other
  9. Rank by the user's picked interests (a topic in their interests first). If
  `feed.rank` saved an order for today, use that.
- `feed.rank({userId})` (action): search Supermemory namespace `user_<id>` for what
  they engage with, then Claude ranks the 9 non-shared topics. Save the order.

## Rooms

- Slots every SLOT_MINUTES (env, default 15) from 7 AM to 10 PM Pacific.
- Bands from the user's stance on the topic: A = 0-35, M = 36-64, B = 65-100.
- `rooms.join`: put the user in the open room for the next slot that has the fewest
  people from their band. Max 6 per room; if all are full, open another room.
- At slot time: a room starts if it has at least 3 people AND
  (highest position - lowest position) >= 40. Start = status "live",
  endsAt = now + 10 min, judge opener. Otherwise status "rolled": move members to the
  next slot and notify them ("We moved you to 8:30").
- 1 minute before a slot: notify every member "Your room starts in 1 minute" + link.
- Judge: opener (1-2 sentences: something the group agrees on, then a question to the
  person furthest from the middle). At minute 4, nudge members with no messages.
  Each message gets a quick personal-attack check; if flagged, a gentle inline judge
  note and good-faith -2. At 0:00, one line on where the group agreed.
- At the end: status "summarizing"; order members randomly in a circle; each
  summarizes the next (`summarizesUserId`).
- A room keeps going while at least 2 members remain. Watchers only if every member
  allowed it.

| Positions at start | Result |
|---|---|
| 10, 48, 85, 90 | Starts (4 people, 80 apart) |
| 20, 30 | Rolls (only 2 people) |
| 60, 70, 75 | Rolls (only 15 apart) |

## Here's what I heard and scoring

- Each person writes one sentence about their assigned person's view, starting "You".
- AI writes its own summary of the same view, same length and tone.
- The summarized person sees both (random order), guesses the human one, sees the
  reveal, rates 1-5.
- Points: rating x 10, plus 20 if they couldn't tell yours from the AI's. Add to
  `users.totalPoints`.
- Good-faith score (0-100, starts 50): (rating - 3) x 2 for the author; AI civility
  rating (1-5) gives (civility - 3) x 2; flagged attack -2.
- Streak: +1 for any day you set a stance.
- After rating: `memory.remember` (Supermemory) runs, which updates the user's insight.

## Notifications

- `notify({userId, message, link})` internal action routes by `users.notifyVia`:
  "text" -> `sendText` via Keiki (POST `KEIKI_SEND_URL`; if unset, console.log),
  "app" -> insert into `notifications`.
- Sent: feed ready (8 AM), room starting in 1 minute, moved to next slot, result.

## Backend contract

Existing functions (already in `convex/`, keep names): `users.create`, `users.get`,
`users.setStance`, `dailyTopics.generate`, `dailyTopics.today`, `dailyTopics.stats`,
`dailyTopics.hide`, `matching.*` (old 1-on-1, keep for now), `conversations.*`,
`summaries.submit`, `summaries.guess`, `summaries.rate`, `summaries.spectatorVote`,
`summaries.voteResults`, `memory.remember`, `memory.updateInsight`, `ai.*`, HTTP
`GET /keiki/today`, `GET /keiki/topic`.

New functions to build:

| Function | Type | Input | Output |
|---|---|---|---|
| `users.onboard` | mutation | name, interests[], notifyVia, phone? | userId |
| `feed.forUser` | query | userId, date | topics[] (shared first) |
| `feed.rank` | action | userId | saves today's order |
| `rooms.next` | query | topicId | { slot, joinedCount } |
| `rooms.join` | mutation | userId, topicId | roomId |
| `rooms.get` | query | roomId | room + members (name, position, band) |
| `rooms.messages` | query | roomId | messages (judge flagged) |
| `rooms.send` | mutation | roomId, userId, text | - |
| `rooms.live` | query | topicId? | rooms open to watchers |
| `summaries.forRoom` | query | roomId | summaries (options hidden until guessed) |
| `notifications.mine` | query | userId | notifications |
| `notifications.markRead` | mutation | notificationId | - |
| `links.redeem` | mutation | code | { userId, roomId } |
| `leaderboard.top` | query | period: "today" or "week" | top 20 |
| `leaderboard.myRank` | query | userId, period | rank |

New HTTP endpoints for Keiki (all check header `x-practify-key` against
`KEIKI_SHARED_SECRET`):

| Endpoint | Body or query | Returns |
|---|---|---|
| `POST /keiki/user` | { phone, name? } | { userId, isNew } |
| `GET /keiki/feed?phone=` | | the user's 4 topics with live split |
| `POST /keiki/take` | { phone, topicId, text } | { status: "saved", position, take } or { status: "unclear", followUp } |
| `POST /keiki/join` | { phone, topicId } | { roomId, slot, link, code } |

Schema additions: users (phone indexed, interests, notifyVia, totalPoints, insight);
topics.isShared; stances (take, source); rooms; roomMembers; roomMessages;
notifications; joinLinks (6-digit code indexed); summaries.roomId (conversationId
becomes optional).

## Screens (app/)

Core, in build order:
1. Onboarding: first name, 3+ interests (Tech, Politics, Culture, Sports, Campus),
   "How should we reach you? In the app / By text" (+ phone). `users.onboard`.
2. Home: shared topic on top, then 3 more (`feed.forUser`). Each card: question, live
   split, "Next room 8:15, 4 joined" (`rooms.next`). Bell with unread count.
3. Topic: brief, both sides, slider (`users.setStance`), "Join the next room"
   (`rooms.join`).
4. Room lobby: countdown, members as dots on a mini scale (`rooms.get`). Live -> Chat.
   Rolled -> "Moved to 8:30".
5. Group chat: judge messages styled differently, opener pinned, position dot per
   sender, 10:00 countdown, `rooms.send`. Summarizing -> next screen.
6. Here's what I heard: "You're summarizing Maya..." `summaries.submit`.
7. Guess and rate: `summaries.forRoom`, `summaries.guess`, `summaries.rate`, plus the
   judge's agreement line.
8. Results: points count-up, streak, good-faith, insight (`users.get`).
9. Inbox: `notifications.mine`, `markRead`, banner on open.
After: Leaderboard, Join (link `practify://join/<code>` or code entry), Watch live.

Design: calm and friendly. White background, one accent color, side A coral and side B
teal (never red/blue). Rounded 16px cards, one main button per screen, 16px body,
22-24px questions. Fake data behind a `USE_FAKE_DATA` flag until the backend is live.

## Keiki agent (keiki/)

System prompt:

> You are Practify, a friendly morning news companion. Each morning, send the user
> their feed from the feed tool: the shared topic first, then their 3, one short line
> each. When they ask about a topic, use the topic tool and explain it neutrally with
> both sides at their strongest. Never take a side or say what you think. Ask
> "What's your take?" and pass their exact words to the take tool; if it returns a
> follow-up question, ask it. Then offer "Want to join the next room on this? It
> starts at <time>." On yes, call the join tool and send the link and code it returns.
> Keep every message short and warm. Never share anyone's phone number.

Tools: getFeed(phone), getTopic(topicId), saveTake(phone, topicId, text),
joinRoom(phone, topicId), calling the endpoints above. A cron loop at 8 AM Pacific
sends each text user their feed. Open questions for the Keiki team: how our backend
sends a text to a specific number, and whether tools receive the sender's number.

## Build plan

Each person runs Capy threads in their own folder, one task per thread:

- Esha (`convex/`): 1 schema; 2 feed (10 topics, isShared, forUser, rank); 3 rooms
  (join, slots, start/roll, judge, circle); 4 summaries in rooms + points; 5 notify +
  notifications; 6 onboard + Keiki endpoints + links; 7 leaderboard.
- Mihika (`app/`): 1 Expo app + Convex + link scheme, running via Revyl; 2 Onboarding
  + Home; 3 Topic + Lobby; 4 Group chat; 5 Here's what I heard + Guess and rate +
  Results; 6 Inbox; then Leaderboard, Join, Watch live.
- Karishma (`keiki/`): 1 agent project with create() + sync; 2 tools; 3 8 AM loop;
  then help with app screens.

Checkpoints: 2:30 topics live, Home on a phone, Keiki answers a text. 3:30 three
phones in one room, judge opens, chat works. 4:15 summaries, results, notifications
both ways. 4:45 leaderboard, join link, feed ranking, watch live. 5:00 freeze.
6:00 submit.

If behind at 3:30, cut in order: Watch live; join by link (keep code); Supermemory
ranking (keep interests); judge nudges; leaderboard. Never cut: feed, take, room,
group chat with judge, Here's what I heard.

## NEW: from the Candle founder conversation

Five changes, built on top of everything above. Where they disagree with earlier
sections, these win.

1. **Profile.** Onboarding asks two things instead of "interests": "I know a lot
   about" (`users.knowWell`, optional) and "I want to learn more about"
   (`users.wantToLearn`, 1+ required), using the same categories. A category can
   be in only one list. `users.interests` is kept and set equal to `wantToLearn`
   so Keiki and older code keep working. `users.onboard` accepts `knowWell` and
   `wantToLearn` (`interests` optional).

2. **Feed.** 4 topics: the shared topic, 2 from `wantToLearn` categories (fall
   back to `interests`), and 1 from a category in neither `wantToLearn` nor
   `knowWell`, to stretch people a little. A saved `feed.rank` order picks
   within each slot. A slot that can't be filled takes the best remaining topic.
   Still never ranked by the user's positions.

3. **Did minds move.** The pitch number: the percent of today's room members
   whose view moved 10+ points. Built on `roomMembers.positionAfter`,
   `rooms.setPositionAfter` and `rooms.mindsMoved`:
   - After the chat ends, before "Here's what I heard", each person answers
     "Where do you stand now?" with the same slider (`rooms.setPositionAfter`).
   - When a room ends, AI reads each member's messages and estimates their end
     position 0-100 with a one-line reason (`roomMembers.endPositionAI`,
     `endReason`). Start and end positions are saved to Supermemory.
   - `stats.today` query: percent of today's room members whose end position
     (their slider if set, else the AI estimate) is 10+ from their start, plus
     counts.
   - Results: "You moved N points toward <side or the middle>" or "You held
     your ground".

4. **Middle person rule.** A room starts only if it also has at least one
   member in band M (36-64); otherwise it rolls like any other failed start.
   When placing a band-M user, prefer a room for that slot with no M member yet.

5. **Featured room.** `rooms.featured({ topicId? })`: the live, watchable room
   with the most messages in the last 2 minutes. The Watch screen shows it at
   the top, labeled "Featured".
