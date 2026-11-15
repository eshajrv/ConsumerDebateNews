import type { Id, Topic, TopicStats } from "../data/types";
import { todayString } from "../date";
import { getUser } from "./users";

const today = todayString();

export const fakeTopics: Topic[] = [
  {
    _id: "topic_ai_code", date: today, category: "tech", isShared: true,
    question: "Should startups let AI write most of their code?",
    sideA: "Yes, ship faster", sideB: "No, keep humans writing it",
    brief: "AI coding tools now write a large share of code at many startups. Founders say it lets tiny teams ship like big ones; critics worry about bugs, security, and junior engineers never learning the craft.",
    sideAView: "Speed is survival for a startup. If a tool lets three people build what used to take thirty, refusing it is a choice to lose.",
    sideBView: "Code you don't understand is code you can't fix. Leaning on AI piles up hidden bugs and skips the learning that makes good engineers.",
    sources: ["The Verge", "Wall Street Journal"],
  },
  {
    _id: "topic_campus_phones", date: today, category: "campus", isShared: false,
    question: "Should lecture halls ban phones and laptops?",
    sideA: "Ban them", sideB: "Let students choose",
    brief: "Several universities are piloting device-free lectures after studies linked multitasking to lower grades.",
    sideAView: "Screens split attention for the user and everyone nearby. A clear rule protects focus for the whole room.",
    sideBView: "Students are adults. Many take notes digitally or need devices for accessibility, so a blanket ban hurts them.",
    sources: ["Inside Higher Ed", "The Daily Californian"],
  },
  {
    _id: "topic_min_wage", date: today, category: "politics", isShared: false,
    question: "Should the federal minimum wage rise to $17?",
    sideA: "Raise it", sideB: "Leave it to states",
    brief: "A new bill would raise the federal minimum wage to $17 over five years. It has been $7.25 since 2009.",
    sideAView: "Prices have climbed for fifteen years while the floor stayed flat. A raise lifts millions out of poverty and boosts spending.",
    sideBView: "Costs differ hugely by region. A national $17 floor could cost jobs in cheaper areas; states can set what fits them.",
    sources: ["NPR", "Fox News", "Reuters"],
  },
  {
    _id: "topic_nil", date: today, category: "sports", isShared: false,
    question: "Should college athletes be paid salaries by their schools?",
    sideA: "Pay them", sideB: "Keep them students",
    brief: "After NIL deals became legal, a court settlement now lets schools share revenue directly with athletes.",
    sideAView: "Athletes generate billions for their schools. Paying them is basic fairness for the people doing the work.",
    sideBView: "Salaries turn college sports into a minor league and squeeze out smaller sports that don't make money.",
    sources: ["ESPN", "The Athletic"],
  },
  {
    _id: "topic_ai_art", date: today, category: "culture", isShared: false,
    question: "Should AI-generated art be allowed in art competitions?",
    sideA: "Allow it", sideB: "Keep it human-made",
    brief: "A state fair's top prize went to an AI-assisted image, reigniting debate about what counts as art.",
    sideAView: "Every new tool, from cameras to Photoshop, was called cheating at first. The idea and the choices still come from a person.",
    sideBView: "Competitions reward human skill. Letting AI in is unfair to artists who spent years learning their craft.",
    sources: ["New York Times", "Artnet"],
  },
  {
    _id: "topic_social_age", date: today, category: "tech", isShared: false,
    question: "Should social media require users to be 16 or older?",
    sideA: "Set the limit at 16", sideB: "Leave it to parents",
    brief: "Several countries have passed laws barring under-16s from social media; US states are considering similar rules.",
    sideAView: "Teens' mental health has suffered as feeds got more addictive. A clear age line takes pressure off kids and parents.",
    sideBView: "Age checks threaten everyone's privacy, and parents know their own kids better than lawmakers do.",
    sources: ["BBC", "Washington Post"],
  },
];

export function forUser({ userId }: { userId: Id; date: string }): Topic[] {
  const interests = getUser({ userId })?.interests ?? [];
  const shared = fakeTopics.filter((t) => t.isShared);
  const rest = fakeTopics
    .filter((t) => !t.isShared)
    .sort((a, b) => Number(interests.includes(b.category)) - Number(interests.includes(a.category)));
  return [...shared, ...rest.slice(0, 3)];
}

export function getTopic(topicId: Id): Topic | undefined {
  return fakeTopics.find((t) => t._id === topicId);
}

export function topicStats({ topicId }: { topicId: Id }): TopicStats {
  const seed = topicId.length;
  const total = 20 + seed * 3;
  const leanA = Math.round(total * (0.35 + (seed % 5) * 0.06));
  return { total, leanA, leanB: total - leanA, talkingNow: 6 + (seed % 4) * 3 };
}
