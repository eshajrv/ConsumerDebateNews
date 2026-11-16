// convex/lib/topicImages.ts
// A fixed set of free-to-use stock photos (Unsplash License) for topic cards.
// Never use images from news articles: they're copyrighted. Every URL here was checked to return an image.
import { Doc } from "../_generated/dataModel";

const u = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`;

export const TOPIC_IMAGES: { keyword: string; category: string; url: string }[] = [
  { keyword: "ballot box", category: "politics", url: u("1540910419892-4a36d2c3266c") },
  { keyword: "capitol building", category: "politics", url: u("1520525003249-2b9cdda513bc") },
  { keyword: "protest", category: "politics", url: u("1511898634545-c01af8a54dd5") },
  { keyword: "smartphone", category: "tech", url: u("1511707171634-5f897ff02aa9") },
  { keyword: "coding", category: "tech", url: u("1461749280684-dccba630e2f6") },
  { keyword: "artificial intelligence", category: "tech", url: u("1677442135703-1787eea5ce01") },
  { keyword: "data center", category: "tech", url: u("1558494949-ef010cbdcc31") },
  { keyword: "movie theater", category: "culture", url: u("1489599849927-2ee91cede3ba") },
  { keyword: "concert", category: "culture", url: u("1459749411175-04bf5292ceea") },
  { keyword: "art museum", category: "culture", url: u("1554907984-15263bfd63bd") },
  { keyword: "books", category: "culture", url: u("1457369804613-52c61a468e7d") },
  { keyword: "stadium", category: "sports", url: u("1489944440615-453fc2b6a9a9") },
  { keyword: "basketball", category: "sports", url: u("1546519638-68e109498ffc") },
  { keyword: "soccer", category: "sports", url: u("1431324155629-1a6deb1dec8d") },
  { keyword: "running track", category: "sports", url: u("1502904550040-7534597429ae") },
  { keyword: "classroom", category: "campus", url: u("1580582932707-520aed937b7b") },
  { keyword: "university campus", category: "campus", url: u("1562774053-701939374585") },
  { keyword: "library", category: "campus", url: u("1524995997946-a1c2e315a42f") },
  { keyword: "graduation", category: "campus", url: u("1627556704302-624286467c65") },
];

// Used when a topic has no imageUrl (the first photo listed for each category)
const CATEGORY_FALLBACK: Record<string, string> = Object.fromEntries(
  [...TOPIC_IMAGES].reverse().map((i) => [i.category, i.url]),
);

export const imageKeywords = () => TOPIC_IMAGES.map((i) => i.keyword);

// The photo for an AI-picked keyword; falls back to the category's photo
export function imageForKeyword(keyword: string | undefined, category: string): string {
  const k = keyword?.trim().toLowerCase();
  return TOPIC_IMAGES.find((i) => i.keyword === k)?.url ?? CATEGORY_FALLBACK[category] ?? TOPIC_IMAGES[0].url;
}

// Without AI: the photo in the topic's category whose keyword words appear most in its text
export function guessImage(t: { category: string; question: string; brief: string }): string {
  const text = `${t.question} ${t.brief}`.toLowerCase();
  let best: { url: string; hits: number } | null = null;
  for (const i of TOPIC_IMAGES.filter((x) => x.category === t.category)) {
    const hits = i.keyword.split(" ").filter((w) => text.includes(w)).length;
    if (hits > 0 && (!best || hits > best.hits)) best = { url: i.url, hits };
  }
  return best?.url ?? imageForKeyword(undefined, t.category);
}

export const topicImage = (t: Pick<Doc<"topics">, "imageUrl" | "category">) =>
  t.imageUrl ?? imageForKeyword(undefined, t.category);
