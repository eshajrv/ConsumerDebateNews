# Practify

Every morning Practify gives you a short news feed that's personal in what it covers
but never in what it tells you to think. Share your take, then join a room of up to
6 people who see it differently for a 10-minute conversation with an AI judge.
You're scored on how well you understood someone, not on winning.

Built at the YC Consumer Mobile Hackathon with Convex, Capy, Revyl, Supermemory and
Keiki.

- `PLAN.md`: the product spec and build plan (start here)
- `AGENTS.md`: rules for Capy and other coding agents
- `convex/`: backend (Convex). See `convex/README.md`
- `app/`: phone app (Expo, run through Revyl)
- `keiki/`: Messages agent (Keiki)

## Run the backend

```
npm install
npx convex dev
```

Then set environment variables in the Convex dashboard (Settings, Environment
Variables): `ANTHROPIC_API_KEY`, `SUPERMEMORY_API_KEY`, `KEIKI_SHARED_SECRET`,
`SLOT_MINUTES` (2 for testing and the demo), and `KEIKI_SEND_URL` once confirmed.
