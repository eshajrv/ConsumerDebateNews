# keiki/ (Karishma)

The Practify agent in Messages, built with Keiki's SDK (`@onkeiki/agents`).

- `src/agent.ts`: `create()` with the name, phone line, model, system prompt, tools and the
  8 AM morning-feed loop.
- `src/tools.ts`: `registerUser`, `getFeed`, `getTopic`, `saveTake`, `joinRoom`. Each calls our
  Convex site URL with the `x-practify-key` header. The sender's number comes from Keiki's
  tool context (`ctx.phone`), never from the model.
- `src/sync.ts`: pushes everything to Keiki with `kit.sync()`.

See `PLAN.md` ("Keiki agent" and "Backend contract") for the endpoints.

## How to run

1. Install [Bun](https://bun.sh) (`brew install oven-sh/bun/bun`). `kit.sync()` must run under
   Bun because it bundles each tool for Keiki's cloud.
2. `cd keiki && npm install`
3. `cp .env.example .env` and fill in `KEIKI_API_KEY`, `KEIKI_PHONE_LINE`, `CONVEX_SITE_URL` and
   `KEIKI_SHARED_SECRET` (the same value as `KEIKI_SHARED_SECRET` in Convex). `.env` is never
   committed. Bun loads it automatically.
4. `npm run typecheck`
5. `npm run sync` pushes the prompt, tools, secrets and loop to Keiki. Run it again after every
   change. Then text the agent's line to try it.

`CONVEX_SITE_URL` and `KEIKI_SHARED_SECRET` are synced as Keiki developer secrets, because tools
run in Keiki's cloud where `process.env` is not available.
