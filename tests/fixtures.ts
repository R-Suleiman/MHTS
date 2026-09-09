import { AppData, daysAgo } from "../src/lib/data";
import { ASSESSMENT_VERSION } from "../src/lib/assessments";
export function demoData(): AppData {
  const now = new Date().toISOString();
  return {
    version: 1,
    profile: { name: "Alex", adult: true, consentAt: now },
    checkins: Array.from({ length: 12 }, (_, i) => ({
      id: `demo-${i}`,
      date: daysAgo(13 - i),
      mood: [3, 3, 2, 4, 3, 4, 3, 4, 4, 3, 4, 5][i],
      stress: [4, 3, 4, 3, 3, 2, 3, 2, 2, 3, 2, 2][i],
      energy: (i % 3) + 2,
      sleep: [6, 7, 6.5, 8, 7, 7.5][i % 6],
      tags: [i % 2 ? "Time outside" : "Studies"],
      note: "Fictional entry for the university demonstration.",
    })),
    assessments: [
      {
        id: "demo-a1",
        date: new Date(`${daysAgo(21)}T10:00:00`).toISOString(),
        version: ASSESSMENT_VERSION,
        who: [2, 3, 2, 3, 3],
        phq: [2, 1, 1, 1],
      },
      {
        id: "demo-a2",
        date: new Date(`${daysAgo(7)}T10:00:00`).toISOString(),
        version: ASSESSMENT_VERSION,
        who: [4, 3, 4, 3, 4],
        phq: [1, 1, 0, 1],
      },
    ],
    actions: [],
  };
}
