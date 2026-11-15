import type { Id, OnboardArgs, User } from "../data/types";
import { changed, newId } from "./store";

export const fakeUsers: User[] = [
  { _id: "user_maya", name: "Maya", interests: ["politics", "campus", "culture"], notifyVia: "app", goodFaithScore: 62, streak: 4, totalPoints: 180 },
  { _id: "user_jordan", name: "Jordan", interests: ["tech", "sports", "politics"], notifyVia: "text", goodFaithScore: 55, streak: 2, totalPoints: 90 },
  { _id: "user_priya", name: "Priya", interests: ["tech", "culture", "campus"], notifyVia: "app", goodFaithScore: 71, streak: 7, totalPoints: 310 },
  { _id: "user_sam", name: "Sam", interests: ["sports", "politics", "campus"], notifyVia: "text", goodFaithScore: 48, streak: 1, totalPoints: 40 },
  { _id: "user_leo", name: "Leo", interests: ["culture", "tech", "sports"], notifyVia: "app", goodFaithScore: 58, streak: 3, totalPoints: 120 },
];

export const stances: { userId: Id; topicId: Id; position: number }[] = [];

export async function onboard(args: OnboardArgs): Promise<Id> {
  const user: User = {
    _id: newId("user"),
    name: args.name.trim().slice(0, 30),
    interests: args.interests,
    notifyVia: args.notifyVia,
    phone: args.notifyVia === "text" ? args.phone : undefined,
    goodFaithScore: 50,
    streak: 0,
    totalPoints: 0,
    insight: "You listen best when the topic is close to home.",
  };
  fakeUsers.push(user);
  changed();
  return user._id;
}

export function getUser({ userId }: { userId: Id }): User | null {
  return fakeUsers.find((u) => u._id === userId) ?? fakeUsers[0];
}

export async function setStance(args: { userId: Id; topicId: Id; position: number; today: string }): Promise<null> {
  const position = Math.max(0, Math.min(100, Math.round(args.position)));
  const existing = stances.find((s) => s.userId === args.userId && s.topicId === args.topicId);
  if (existing) existing.position = position;
  else stances.push({ userId: args.userId, topicId: args.topicId, position });
  changed();
  return null;
}
