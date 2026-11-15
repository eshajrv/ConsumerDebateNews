import type { Id, Room, RoomSummaries, Summary } from "../data/types";
import { getTopic } from "./feed";
import { getRoom } from "./rooms";
import { changed, newId } from "./store";
import { fakeUsers } from "./users";

type FakeSummary = {
  _id: Id;
  roomId: Id;
  authorId: Id;
  aboutUserId: Id;
  humanText: string;
  aiText?: string;
  humanIsFirst: boolean;
  subjectGuess?: "first" | "second";
  gotMeRating?: number;
  points?: number;
};

const OTHERS_READY_MS = 2000;
const MINE_RATED_MS = 3000;
const FAKE_RATING = 4;

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

const liveRooms = new Map<Id, Room>();

export function rememberRoom(room: Room) {
  liveRooms.set(room._id, room);
}

const roomFor = (roomId: Id) => liveRooms.get(roomId) ?? getRoom({ roomId });

const nameOf = (room: Room | null | undefined, userId: Id) =>
  room?.members.find((m) => m.userId === userId)?.name ?? fakeUsers.find((u) => u._id === userId)?.name ?? "";

const toSummary = (s: FakeSummary, userId: Id, room: Room | null | undefined): Summary => {
  const guessed = s.subjectGuess !== undefined;
  const ready = s.aiText !== undefined;
  const aboutMe = s.aboutUserId === userId;
  return {
    _id: s._id,
    authorId: s.authorId,
    authorName: nameOf(room, s.authorId),
    aboutUserId: s.aboutUserId,
    aboutName: nameOf(room, s.aboutUserId),
    aboutMe,
    ready,
    options: ready && (aboutMe || guessed) ? (s.humanIsFirst ? [s.humanText, s.aiText!] : [s.aiText!, s.humanText]) : null,
    guessed,
    subjectGuess: s.subjectGuess ?? null,
    humanIs: guessed ? (s.humanIsFirst ? "first" : "second") : null,
    gotMeRating: s.gotMeRating ?? null,
    points: s.points ?? null,
  };
};

const firstSentence = (text: string) => {
  const sentence = text.split(/(?<=\.)\s/)[0];
  return sentence.charAt(0).toLowerCase() + sentence.slice(1);
};

export function fakeLinesAbout(roomId: Id, aboutUserId: Id): { humanText: string; aiText: string } {
  const room = roomFor(roomId);
  const topic = room ? (room.topic ?? getTopic(room.topicId)) : undefined;
  const position = room?.members.find((m) => m.userId === aboutUserId)?.position ?? 50;
  if (!topic) {
    return {
      humanText: "You think the details matter more than the headline, so you want people to slow down first.",
      aiText: "You believe the details matter more than the headline, and you want people to slow down before deciding.",
    };
  }
  const leansA = position < 50;
  const side = leansA ? topic.sideA : topic.sideB;
  const view = leansA ? topic.sideAView : topic.sideBView;
  const middle = position > 35 && position < 65;
  return {
    humanText: middle
      ? `You see the point on both sides, but you lean "${side.toLowerCase()}" because ${firstSentence(view)}`
      : `You're firmly "${side.toLowerCase()}", mostly because ${firstSentence(view)}`,
    aiText: middle
      ? `You're open to both sides but lean toward "${side}", since ${firstSentence(view)}`
      : `You land on "${side}" because ${firstSentence(view)}`,
  };
}

function applyRating(s: FakeSummary, gotMeRating: number) {
  const rating = Math.max(1, Math.min(5, Math.round(gotMeRating)));
  const couldntTell = s.subjectGuess !== (s.humanIsFirst ? "first" : "second");
  s.gotMeRating = rating;
  s.points = rating * 10 + (couldntTell ? 20 : 0);

  const author = fakeUsers.find((u) => u._id === s.authorId);
  if (!author) return;
  author.totalPoints = (author.totalPoints ?? 0) + s.points;
  author.goodFaithScore = Math.max(0, Math.min(100, author.goodFaithScore + (rating - 3) * 2));
  const room = roomFor(s.roomId);
  const topic = room ? (room.topic ?? getTopic(room.topicId)) : undefined;
  if (topic) author.insight = `You're most open on ${topic.category} topics.`;
}

export function summariesForRoom({ roomId, userId }: { roomId: Id; userId: Id }): RoomSummaries | null {
  const room = roomFor(roomId);
  if (!room) return null;
  return {
    status: room.status,
    agreementLine: room.agreementLine ?? null,
    summaries: fakeSummaries.filter((s) => s.roomId === roomId).map((s) => toSummary(s, userId, room)),
  };
}

export async function submitSummary({ roomId, authorId, text }: { roomId: Id; authorId: Id; text: string }): Promise<null> {
  if (fakeSummaries.some((s) => s.roomId === roomId && s.authorId === authorId)) return null;
  const room = roomFor(roomId);
  const members = room?.members ?? [];
  const aboutUserId =
    members.find((m) => m.userId === authorId)?.summarizesUserId ?? members.find((m) => m.userId !== authorId)?.userId ?? "user_maya";

  const mine: FakeSummary = {
    _id: newId("summary"),
    roomId,
    authorId,
    aboutUserId,
    humanText: text.trim().slice(0, 300),
    humanIsFirst: Math.random() < 0.5,
  };
  fakeSummaries.push(mine);
  changed();

  setTimeout(() => {
    mine.aiText = fakeLinesAbout(roomId, aboutUserId).aiText;
    for (const m of members) {
      if (m.userId === authorId || !m.summarizesUserId) continue;
      if (fakeSummaries.some((s) => s.roomId === roomId && s.authorId === m.userId)) continue;
      fakeSummaries.push({
        _id: newId("summary"),
        roomId,
        authorId: m.userId,
        aboutUserId: m.summarizesUserId,
        ...fakeLinesAbout(roomId, m.summarizesUserId),
        humanIsFirst: Math.random() < 0.5,
      });
    }
    changed();
  }, OTHERS_READY_MS);

  setTimeout(() => {
    if (mine.gotMeRating) return;
    mine.subjectGuess ??= Math.random() < 0.5 ? "first" : "second";
    applyRating(mine, FAKE_RATING);
    changed();
  }, MINE_RATED_MS);

  return null;
}

export async function guessSummary({ summaryId, pick }: { summaryId: Id; userId: Id; pick: "first" | "second" }): Promise<null> {
  const s = fakeSummaries.find((x) => x._id === summaryId);
  if (s?.aiText && !s.subjectGuess) s.subjectGuess = pick;
  changed();
  return null;
}

export async function rateSummary({ summaryId, gotMeRating }: { summaryId: Id; userId: Id; gotMeRating: number }): Promise<null> {
  const s = fakeSummaries.find((x) => x._id === summaryId);
  if (s?.subjectGuess && !s.gotMeRating) applyRating(s, gotMeRating);
  changed();
  return null;
}
