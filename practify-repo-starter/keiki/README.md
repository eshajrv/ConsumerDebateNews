# keiki/ (Karishma)

The Practify agent in Messages, built with Keiki's SDK (`@onkeiki/agents`).

First Capy task: create a small TypeScript project here that defines the agent with
`create()` (name, phone line, model, system prompt, tools) and an npm script `sync`
that runs `kit.sync()` to push it to Keiki. The tools call our Convex site URL
(ends in `.convex.site`) with the header `x-practify-key`. See `PLAN.md`
("Keiki agent") for the system prompt, tools and the 8 AM schedule.

Keys go in `keiki/.env` (never committed). Copy `.env.example` to start.
