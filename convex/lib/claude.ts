// convex/lib/claude.ts
// Shared helper for calling the AI model from Convex actions.
// The hackathon credits are OpenAI, so this calls OpenAI's Chat Completions API.
// Set OPENAI_API_KEY in your Convex dashboard (Settings > Environment Variables).
// The name askClaude is kept so existing callers don't change.

const MODEL = "gpt-4.1";

export async function askClaude(prompt: string, maxTokens = 1000): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.OPENAI_API_KEY!}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content ?? "";
}

// Pulls the first JSON object or array out of a model response.
export function extractJson<T>(text: string): T {
  const start = text.search(/[[{]/);
  const end = Math.max(text.lastIndexOf("]"), text.lastIndexOf("}"));
  return JSON.parse(text.slice(start, end + 1)) as T;
}
