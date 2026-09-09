import { demoData } from "./fixtures";
import test from "node:test";
import assert from "node:assert/strict";
import { scoreAssessment } from "../src/lib/assessments";
import {
  chartDays,
  dataSchema,
  daysAgo,
  emptyData,
  localDay,
  recommendations,
  upsertCheckin,
} from "../src/lib/data";

test("WHO-5 extremes and suggested threshold are scored independently of PHQ-4", () => {
  assert.equal(
    scoreAssessment({ who: [0, 0, 0, 0, 0], phq: [3, 3, 3, 3] }).wellbeing,
    0,
  );
  assert.equal(
    scoreAssessment({ who: [5, 5, 5, 5, 5], phq: [0, 0, 0, 0] }).wellbeing,
    100,
  );
  assert.equal(
    scoreAssessment({ who: [2, 2, 2, 3, 3], phq: [0, 0, 0, 0] }).wellbeing,
    48,
  );
  assert.equal(
    scoreAssessment({ who: [2, 2, 3, 3, 3], phq: [0, 0, 0, 0] }).wellbeing,
    52,
  );
});
test("PHQ-4 categorization covers every boundary and keeps subscales distinct", () => {
  for (const [answers, expected] of [
    [[0, 0, 0, 0], "Minimal"],
    [[1, 1, 0, 0], "Minimal"],
    [[1, 2, 0, 0], "Mild"],
    [[3, 2, 0, 0], "Mild"],
    [[3, 3, 0, 0], "Moderate"],
    [[3, 3, 2, 0], "Moderate"],
    [[3, 3, 3, 0], "Severe"],
    [[3, 3, 3, 3], "Severe"],
  ] as const)
    assert.equal(
      scoreAssessment({ who: [3, 3, 3, 3, 3], phq: answers }).distress,
      expected,
    );
  const scores = scoreAssessment({ who: [5, 5, 5, 5, 5], phq: [1, 2, 0, 1] });
  assert.equal(scores.anxiety, 3);
  assert.equal(scores.depression, 1);
});
test("missing, fractional, extra, and out-of-range answers are rejected", () => {
  for (const who of [
    [1, 2],
    [null, 2, 2, 2, 2],
    [6, 2, 2, 2, 2],
    [1.5, 2, 2, 2, 2],
    [-1, 2, 2, 2, 2],
    [1, 1, 1, 1, 1, 1],
  ])
    assert.throws(() => scoreAssessment({ who, phq: [0, 0, 0, 0] }));
  assert.throws(() =>
    scoreAssessment({ who: [1, 1, 1, 1, 1], phq: [0, 0, 4, 0] }),
  );
});
test("updating today's entry replaces it and preserves other days", () => {
  const entry = {
    id: "one",
    date: localDay(),
    mood: 3,
    stress: 2,
    energy: 3,
    sleep: 7,
    tags: [],
    note: "",
  };
  let data = upsertCheckin(emptyData(), {
    ...entry,
    id: "older",
    date: daysAgo(1),
  });
  data = upsertCheckin(data, entry);
  data = upsertCheckin(data, { ...entry, mood: 5 });
  assert.equal(data.checkins.length, 2);
  assert.equal(data.checkins.find((c) => c.date === localDay())?.mood, 5);
});
test("chart preserves missing dates as null, including zero recorded entries", () => {
  const points = chartDays(emptyData(), 7);
  assert.equal(points.length, 7);
  assert.ok(points.every((p) => p.mood === null && p.stress === null));
  assert.equal(points[6].date, localDay());
});
test("demo is valid and does not insert an entry for today", () => {
  const data = dataSchema.parse(demoData());
  assert.equal(data.checkins.length, 12);
  assert.ok(!data.checkins.some((c) => c.date === localDay()));
  assert.equal(scoreAssessment(data.assessments[1]).wellbeing, 72);
});
test("recommendation rules prioritize professional support without a diagnosis", () => {
  const data = demoData();
  data.assessments[1].phq = [2, 1, 0, 0];
  assert.equal(recommendations(data)[0].id, "support");
  data.assessments[1].phq = [0, 0, 0, 0];
  data.assessments[1].who = [2, 2, 2, 3, 3];
  assert.equal(recommendations(data)[0].id, "support");
});
