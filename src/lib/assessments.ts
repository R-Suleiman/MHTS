import { z } from "zod";

export const assessmentInput = z.object({
  who: z.array(z.number().int().min(0).max(5)).length(5),
  phq: z.array(z.number().int().min(0).max(3)).length(4),
});
export type AssessmentInput = z.infer<typeof assessmentInput>;
export const WHO_QUESTIONS = [
  "I have felt cheerful and in good spirits",
  "I have felt calm and relaxed",
  "I have felt active and vigorous",
  "I woke up feeling fresh and rested",
  "My daily life has been filled with things that interest me",
];
export const WHO_OPTIONS = [
  "At no time",
  "Some of the time",
  "Less than half of the time",
  "More than half of the time",
  "Most of the time",
  "All of the time",
];
export const PHQ_QUESTIONS = [
  "Feeling nervous, anxious or on edge",
  "Not being able to stop or control worrying",
  "Feeling down, depressed or hopeless",
  "Little interest or pleasure in doing things",
];
export const PHQ_OPTIONS = [
  "Not at all",
  "Several days",
  "More than half the days",
  "Nearly every day",
];
export function scoreAssessment(input: unknown) {
  const { who, phq } = assessmentInput.parse(input);
  const whoRaw = who.reduce((a, b) => a + b, 0);
  const phqTotal = phq.reduce((a, b) => a + b, 0);
  return {
    whoRaw,
    wellbeing: whoRaw * 4,
    phqTotal,
    anxiety: phq[0] + phq[1],
    depression: phq[2] + phq[3],
    distress:
      phqTotal < 3
        ? "Minimal"
        : phqTotal < 6
          ? "Mild"
          : phqTotal < 9
            ? "Moderate"
            : "Severe",
  };
}
export const ASSESSMENT_VERSION = "who5-2024-phq4-2009-v1";
