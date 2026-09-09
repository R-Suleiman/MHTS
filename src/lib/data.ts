import { z } from "zod";
import {
  assessmentInput,
  ASSESSMENT_VERSION,
  scoreAssessment,
} from "./assessments";

export const STORAGE_KEY = "mhts-prototype-v1";
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return localDay(date);
}
export function prettyDate(date: string) {
  return new Date(
    date.length === 10 ? `${date}T12:00:00` : date,
  ).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
const rating = z.number().int().min(1).max(5);
export const checkinSchema = z.object({
  id: z.string(),
  date: z.iso.date(),
  mood: rating,
  stress: rating,
  energy: rating,
  sleep: z.number().min(0).max(24),
  tags: z.array(z.string().max(40)).max(8),
  note: z.string().max(500),
});
const assessmentSchema = assessmentInput.extend({
  id: z.string(),
  date: z.iso.datetime(),
  version: z.literal(ASSESSMENT_VERSION),
});
export const dataSchema = z.object({
  version: z.literal(1),
  profile: z
    .object({
      name: z.string().trim().min(1).max(40),
      adult: z.literal(true),
      consentAt: z.iso.datetime(),
    })
    .nullable(),
  checkins: z.array(checkinSchema),
  assessments: z.array(assessmentSchema),
  actions: z.array(z.object({ id: z.string(), completed: z.boolean() })),
});
export type AppData = z.infer<typeof dataSchema>;
export type Checkin = z.infer<typeof checkinSchema>;
export type Assessment = z.infer<typeof assessmentSchema>;
export const emptyData = (): AppData => ({
  version: 1,
  profile: null,
  checkins: [],
  assessments: [],
  actions: [],
});
export function upsertCheckin(data: AppData, input: Checkin): AppData {
  const entry = checkinSchema.parse(input);
  return {
    ...data,
    checkins: [
      ...data.checkins.filter((c) => c.date !== entry.date),
      entry,
    ].sort((a, b) => a.date.localeCompare(b.date)),
  };
}
export function latestAssessment(data: AppData) {
  return [...data.assessments].sort((a, b) => b.date.localeCompare(a.date))[0];
}
export function chartDays(data: AppData, count: number) {
  return Array.from({ length: count }, (_, i) => {
    const date = daysAgo(count - 1 - i);
    const entry = data.checkins.find((c) => c.date === date);
    return {
      date,
      label: new Date(`${date}T12:00:00`).toLocaleDateString("en", {
        month: "short",
        day: "numeric",
      }),
      mood: entry?.mood ?? null,
      stress: entry?.stress ?? null,
    };
  });
}
export type Recommendation = {
  id: string;
  title: string;
  description: string;
  reason: string;
  category: string;
  minutes: string;
};
export function recommendations(data: AppData): Recommendation[] {
  const last = latestAssessment(data);
  const score = last ? scoreAssessment(last) : null;
  const recent = data.checkins.filter(
    (c) => c.date >= daysAgo(6) && c.date <= localDay(),
  );
  const items: Recommendation[] = [];
  if (
    score &&
    (score.wellbeing < 50 || score.anxiety >= 3 || score.depression >= 3)
  )
    items.push({
      id: "support",
      title: "Make space for a conversation",
      description:
        "Consider discussing these results with a qualified health professional. You can export your history to bring along.",
      reason:
        "Your latest screening suggests that further assessment may be helpful. This does not establish a diagnosis.",
      category: "Support",
      minutes: "At your pace",
    });
  if (recent.filter((c) => c.sleep < 7).length >= 3)
    items.push({
      id: "sleep",
      title: "Make a little room for rest",
      description:
        "Choose a consistent wind-down time and a quiet activity you enjoy before bed.",
      reason:
        "You logged less than seven hours of sleep on at least three days this week. Sleep needs vary.",
      category: "Rest",
      minutes: "10 min",
    });
  items.push(
    {
      id: "pause",
      title: "Take a mindful pause",
      description:
        "Sit comfortably, notice the things around you, and breathe naturally. Stop if it feels uncomfortable.",
      reason: recent.some((c) => c.stress >= 4)
        ? "You reported high stress in a recent check-in."
        : "A gentle activity to try and reflect on, if it suits you.",
      category: "Mindfulness",
      minutes: "2 min",
    },
    {
      id: "outside",
      title: "A moment of fresh air",
      description:
        "Spend a few minutes outdoors, or sit by an open window if that is more comfortable. Notice the sounds and light.",
      reason: "A small, accessible way to make space for yourself today.",
      category: "Everyday care",
      minutes: "5 min",
    },
    {
      id: "connect",
      title: "Check in with someone",
      description:
        "Send a message or make time to talk with someone you trust. You can share as much or as little as you like.",
      reason: "An optional way to build connection into your day.",
      category: "Connection",
      minutes: "5 min",
    },
  );
  return items;
}
