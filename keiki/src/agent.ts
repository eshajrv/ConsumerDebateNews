import { create } from '@onkeiki/agents'
import { Effect } from 'effect'
import { getFeed, getTopic, joinRoom, registerUser, saveTake } from './tools.js'

const env = (name: string) => {
  // Bun script, not the Expo app: Expo's static env inlining doesn't apply here.
  // eslint-disable-next-line expo/no-dynamic-env-var
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}: copy keiki/.env.example to keiki/.env and fill it in`)
  return value
}

const SYSTEM_PROMPT = `You are Practify, a friendly morning news companion over text. When someone texts you for the first time, call registerUser and ask their first name. Send their feed with getFeed: the shared topic of the day first, then their 3 others, one short line each with how people are split. When they ask about a topic, call getTopic and explain it neutrally in 2-3 sentences with both sides at their strongest. Never take a side or say what you think, even if asked. Ask 'What's your take?' and pass their exact words to saveTake. If it returns status 'unclear', ask the followUp question. Then offer 'Want to join the next room on this? It starts at <slot time>.' Before calling joinRoom, ask 'Want a 1-on-1 or a group room?' and pass mode 'duo' or 'group'. On yes, call joinRoom and send: 'You're in! Tap to join: <link> (code: <code>)'. Keep every message short (1-3 sentences) and warm, at most one emoji. Only state facts from your tools. Never share anyone's phone number or personal info. If someone is insulting, politely steer back to the topic.

After you register someone new, call create_loop with preset 'morning_feed' once so they get their feed every morning at 8.

Topic ids: always use the exact \`id\` values from getFeed. If the user replies
with a number or a topic name, map it to that topic's id; if you don't have
the ids in this turn, call getFeed first. Never pass a list number as topicId.
Joining: call joinRoom only once per topic. If they ask for the link or code
again, resend the one you already sent; never call joinRoom again for it.
Times: all times are Pacific (America/Los_Angeles). Convert the slot time to
Pacific and write it like '3:15 PM'.
Takes: if saveTake returns 'unclear', ask the followUp and mention they can
also reply with a number from 0 to 100.
If someone says they want to debate or talk to someone, suggest the shared
topic of the day, get their take, then offer the room.
If a tool fails, say briefly that Practify is still being set up and to try
again in a minute. Never invent reasons.`

// TODO(keiki): confirm this loop preset is the right way to run the 8 AM feed.
// Alerts (defineAlert) broadcast to subscribers, but their generate() runs on our own
// /alerts/execute server (kit.serve or the alerts plugin), not in Keiki's cloud, and the
// SDK has no documented way to list users. A loop preset runs in Keiki's cloud per
// conversation, but the model has to start it with create_loop (see the prompt above).
const morningFeed = {
  name: 'morning_feed',
  description: "Text the user today's Practify feed every morning at 8 AM Pacific.",
  prompt:
    "It's 8 AM. Call getFeed and send today's feed: the shared topic of the day first, then their 3 others, one short line each with how people are split. End by asking which one they want to hear about.",
  scheduleType: 'cron',
  scheduleExpression: '0 8 * * *',
  timezone: 'America/Los_Angeles',
} as const

export const kit = create({
  apiKey: env('KEIKI_API_KEY'),
  name: 'Practify',
  // TODO(keiki): the docs say kit.sync() ignores resolveNumber and the platform replies on
  // the line the person texted. Ask how to pin the agent to KEIKI_PHONE_LINE from code.
  resolveNumber: () => Effect.succeed(env('KEIKI_PHONE_LINE')),
  secrets: {
    CONVEX_SITE_URL: env('CONVEX_SITE_URL'),
    KEIKI_SHARED_SECRET: env('KEIKI_SHARED_SECRET'),
  },
  agent: {
    // TODO(keiki): confirm the model slug; this is the one in Keiki's docs examples.
    model: 'google/gemini-3.5-flash',
    maxSteps: 10,
    historyLimit: 40,
    systemPrompt: () => SYSTEM_PROMPT,
    tools: [registerUser, getFeed, getTopic, saveTake, joinRoom],
    loops: { enabled: true, presets: [morningFeed] },
  },
})
