# Instructions for coding agents (Capy and others)

Read `PLAN.md` before doing anything. It is the spec for the whole product.
Then read `convex/README.md` for the backend's functions.

## Folder ownership (do not edit other folders)

| Folder | Owner | What it is |
|---|---|---|
| `convex/` | Esha | Convex backend: database, feed, rooms, AI judge, Supermemory, Keiki endpoints |
| `app/` | Mihika | Expo (React Native) app, run on a phone through Revyl |
| `keiki/` | Karishma | Keiki agent (Messages front door) |

Only change files inside the folder your task is about. If a task needs a change in
another folder, say so in the pull request instead of making it.

## Rules

- Keep existing Convex function names exactly as they are. They are the contract
  between the app, the Keiki agent and the backend. New functions use the names in
  `PLAN.md` ("Backend contract").
- Never put API keys in code. Backend keys are Convex environment variables; Keiki
  keys go in Keiki secrets or `keiki/.env` (never committed).
- Prefer simple code that works over clever code. This is a one-day hackathon:
  code is due at 6 PM.
- Type-check before opening a pull request (`npx tsc --noEmit` in the folder, or
  `npx convex dev --once` for the backend).
- Keep pull requests small: one task per pull request.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
