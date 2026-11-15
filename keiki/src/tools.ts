import { defineTool, type ToolContext } from '@onkeiki/agents'
import { Effect, Schema } from 'effect'

// Tools run inside Keiki's cloud actors, where process.env is not available.
// CONVEX_SITE_URL and KEIKI_SHARED_SECRET are synced as Keiki developer secrets
// (see agent.ts) and read here through ctx.secrets.
// The sender's number always comes from ctx.phone, never from the model, so one
// texter can never act as (or read data for) another phone number.
const convex = (ctx: ToolContext, path: string, body?: Record<string, unknown>) =>
  Effect.gen(function* () {
    const baseUrl = yield* ctx.secrets.get('CONVEX_SITE_URL')
    const sharedSecret = yield* ctx.secrets.get('KEIKI_SHARED_SECRET')
    if (!baseUrl || !sharedSecret) {
      return yield* Effect.dieMessage('CONVEX_SITE_URL and KEIKI_SHARED_SECRET must be synced as Keiki secrets')
    }
    return yield* Effect.promise(async () => {
      const res = await fetch(new URL(path, baseUrl), {
        method: body ? 'POST' : 'GET',
        headers: {
          'x-practify-key': sharedSecret,
          ...(body ? { 'content-type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      })
      const text = await res.text()
      if (!res.ok) throw new Error(`Practify ${path} returned ${res.status}: ${text}`)
      return JSON.parse(text) as unknown
    })
  })

export const registerUser = defineTool({
  name: 'registerUser',
  description:
    "Register the person texting with Practify (safe to call again). Pass their first name once they share it. Returns { userId, isNew }.",
  input: Schema.Struct({ name: Schema.optional(Schema.String) }),
  execute: (input, ctx) => convex(ctx, '/keiki/user', { phone: ctx.phone, name: input.name }),
})

export const getFeed = defineTool({
  name: 'getFeed',
  description:
    "Get today's feed for the person texting: the shared topic of the day first, then their 3 other topics, each with how people are split.",
  input: Schema.Struct({}),
  execute: (_input, ctx) => convex(ctx, `/keiki/feed?phone=${encodeURIComponent(ctx.phone)}`),
})

export const getTopic = defineTool({
  name: 'getTopic',
  description: "Get one of today's topics in full: the neutral brief, both sides and their strongest views, and sources.",
  input: Schema.Struct({ topicId: Schema.String }),
  execute: (input, ctx) => convex(ctx, `/keiki/topic?id=${encodeURIComponent(input.topicId)}`),
})

export const saveTake = defineTool({
  name: 'saveTake',
  description:
    "Save the person's take on a topic. Pass their exact words. Returns { status: 'saved', position, take } or { status: 'unclear', followUp }.",
  input: Schema.Struct({ topicId: Schema.String, text: Schema.String }),
  execute: (input, ctx) =>
    convex(ctx, '/keiki/take', { phone: ctx.phone, topicId: input.topicId, text: input.text }),
})

export const joinRoom = defineTool({
  name: 'joinRoom',
  description:
    'Put the person in the next room for a topic. Returns { roomId, slot, link, code }. Only call after they say yes.',
  input: Schema.Struct({ topicId: Schema.String }),
  execute: (input, ctx) => convex(ctx, '/keiki/join', { phone: ctx.phone, topicId: input.topicId }),
})
