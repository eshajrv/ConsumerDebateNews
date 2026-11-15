import type { Id, Summary } from "../data/types";
import { changed, newId } from "./store";

type FakeSummary = {
  _id: Id;
  roomId: Id;
  authorId: Id;
  aboutUserId: Id;
  humanText: string;
  aiText: string;
  humanIsFirst: boolean;
  subjectGuess?: "first" | "second";
  gotMeRating?: number;
  points?: number;
};

export const fakeSummaries: FakeSummary[] = [
  {
    _id: "summary_demo",
    roomId: "room_demo",
    authorId: "user_leo",
    aboutUserId: "user_maya",
    humanText: "You think AI code is risky mostly because nobody checks the checker, not because AI is bad at coding.",
    aiText: "You worry that when AI writes both the code and the tests, real mistakes slip through unnoticed.",
    humanIsFirst: false,
  },
];

const toSummary = (s: FakeSummary): Summary => {
  const guessed = s.subjectGuess !== undefined;
  return {
    _id: s._id,
    authorId: s.authorId,
    aboutUserId: s.aboutUserId,
    ready: true,
    options: s.humanIsFirst ? [s.humanText, s.aiText] : [s.aiText, s.humanText],
    guessed,
    humanIs: guessed ? (s.humanIsFirst ? "first" : "second") : undefined,
    gotMeRating: s.gotMeRating,
    points: s.points,
  };
};

export function summariesForRoom({ roomId }: { roomId: Id }): Summary[] {
  return fakeSummaries.filter((s) => s.roomId === roomId).map(toSummary);
}

export async function submitSummary({ roomId, authorId, text }: { roomId: Id; authorId: Id; text: string }): Promise<null> {
  fakeSummaries.push({
    _id: newId("summary"),
    roomId,
    authorId,
    aboutUserId: "user_maya",
    humanText: text.trim(),
    aiText: "You believe the details matter more than the headline, and you want people to slow down before deciding.",
    humanIsFirst: Math.random() < 0.5,
  });
  changed();
  return null;
}

export async function guessSummary({ summaryId, pick }: { summaryId: Id; userId: Id; pick: "first" | "second" }): Promise<null> {
  const s = fakeSummaries.find((x) => x._id === summaryId);
  if (s && !s.subjectGuess) s.subjectGuess = pick;
  changed();
  return null;
}

export async function rateSummary({ summaryId, gotMeRating }: { summaryId: Id; userId: Id; gotMeRating: number }): Promise<null> {
  const s = fakeSummaries.find((x) => x._id === summaryId);
  if (s?.subjectGuess && !s.gotMeRating) {
    const rating = Math.max(1, Math.min(5, Math.round(gotMeRating)));
    const couldntTell = s.subjectGuess !== (s.humanIsFirst ? "first" : "second");
    s.gotMeRating = rating;
    s.points = rating * 10 + (couldntTell ? 20 : 0);
  }
  changed();
  return null;
}
