"use client";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ClipboardList,
  Heart,
  Moon,
  Sparkles,
  Sun,
  Wind,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useState } from "react";
import {
  AppData,
  chartDays,
  daysAgo,
  latestAssessment,
  localDay,
  prettyDate,
  recommendations,
} from "@/lib/data";
import { scoreAssessment } from "@/lib/assessments";

export type View =
  | "Overview"
  | "Assessments"
  | "Daily check-in"
  | "My history"
  | "For you"
  | "Settings"
  | "Get support";
export function TrendChart({ data }: { data: AppData }) {
  const [range, setRange] = useState(7);
  const points = chartDays(data, range);
  const hasEntries = points.some((p) => p.mood !== null);
  return (
    <section className="card trend-card">
      <div className="section-head">
        <div>
          <h2>Your daily rhythm</h2>
          <p>A little perspective on how you’ve been feeling.</p>
        </div>
        <select
          aria-label="Chart time range"
          value={range}
          onChange={(e) => setRange(Number(e.target.value))}
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
        </select>
      </div>
      <div className="chart-key">
        <span>
          <i className="dot teal" />
          Mood
        </span>
        <span>
          <i className="dot peach" />
          Stress
        </span>
        <span className="muted">Self-ratings · 1–5</span>
      </div>
      {hasEntries ? (
        <>
          <div
            className="chart"
            role="img"
            aria-label="Mood and stress history. An accessible table is available below."
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={points}
                margin={{ top: 10, right: 14, left: -27, bottom: 4 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="#edf0eb"
                  strokeDasharray="4 4"
                />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#738078" }}
                  minTickGap={30}
                  dy={10}
                />
                <YAxis
                  domain={[1, 5]}
                  ticks={[1, 2, 3, 4, 5]}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#738078" }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #e3e9e2",
                  }}
                />
                <Line
                  name="Mood"
                  type="linear"
                  dataKey="mood"
                  stroke="#42816b"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#fff", strokeWidth: 2 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                <Line
                  name="Stress"
                  type="linear"
                  dataKey="stress"
                  stroke="#d8a184"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 3, fill: "#fff" }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <details className="chart-table">
            <summary>View chart as a table</summary>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Mood / 5</th>
                    <th>Stress / 5</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((p) => (
                    <tr key={p.date}>
                      <td>{prettyDate(p.date)}</td>
                      <td>{p.mood ?? "No entry"}</td>
                      <td>{p.stress ?? "No entry"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      ) : (
        <div className="empty-chart">
          <Wind size={30} />
          <h3>Your story starts with a check-in</h3>
          <p>Log how you feel to see your daily rhythm here.</p>
        </div>
      )}
      <p className="chart-note">
        Every day is different. Missing days stay as gaps, and that’s okay.
      </p>
    </section>
  );
}

export function Overview({
  data,
  navigate,
  startCheckin,
}: {
  data: AppData;
  navigate: (view: View) => void;
  startCheckin: () => void;
}) {
  const latest = latestAssessment(data);
  const score = latest ? scoreAssessment(latest) : null;
  const prior = [...data.assessments].sort((a, b) =>
    b.date.localeCompare(a.date),
  )[1];
  const change =
    score && prior ? score.wellbeing - scoreAssessment(prior).wellbeing : null;
  const recent = data.checkins.filter(
    (c) => c.date >= daysAgo(6) && c.date <= localDay(),
  );
  const sleep = recent.length
    ? (recent.reduce((n, c) => n + c.sleep, 0) / recent.length).toFixed(1)
    : null;
  const today = data.checkins.find((c) => c.date === localDay());
  const ideas = recommendations(data).slice(0, 2);
  return (
    <>
      <section className="welcome-banner">
        <div>
          <span className="eyebrow">
            <span className="tiny-sun">✳</span> A LITTLE SPACE FOR YOURSELF
          </span>
          <h2>
            Small check-ins.
            <br />
            Meaningful steps forward.
          </h2>
          <p>
            You don’t have to have it all figured out.
            <br />
            Start with how you feel today.
          </p>
          <button className="button primary" onClick={startCheckin}>
            {today ? "Update today’s check-in" : "Let’s check in"}
            <ArrowRight size={16} />
          </button>
        </div>
        <div className="garden" aria-hidden="true">
          <div className="sun-disc" />
          <div className="orbit one" />
          <div className="orbit two" />
          <div className="ground" />
          <div className="plant-stem" />
          <div className="leaf l1" />
          <div className="leaf l2" />
          <div className="leaf l3" />
          <div className="leaf l4" />
          <div className="leaf l5" />
          <div className="leaf l6" />
          <span className="garden-spark s1">✧</span>
          <span className="garden-spark s2">✧</span>
          <div className="garden-label">
            <span className="dot teal" /> Growing at your own pace
          </div>
        </div>
      </section>
      <div className="section-head overview-label">
        <h2>Your well-being at a glance</h2>
        <span className="muted small">A reflection, never a diagnosis</span>
      </div>
      <div className="stats-grid">
        <section className="card stat">
          <div className="stat-title">
            <span>Well-being</span>
            <span className="icon-box sage">
              <Heart size={18} />
            </span>
          </div>
          <div className="stat-number">
            {score?.wellbeing ?? "—"}
            <small>/ 100</small>
          </div>
          <p>
            WHO-5 · {latest ? prettyDate(latest.date) : "No assessment yet"}
          </p>
          <div className="stat-foot">
            {change !== null ? (
              <>
                <span className="change">
                  {change >= 0 ? (
                    <ArrowUpRight size={14} />
                  ) : (
                    <ArrowDownRight size={14} />
                  )}
                  {Math.abs(change)} points
                </span>
                <span>since last assessment</span>
              </>
            ) : (
              <span>Build a picture over time</span>
            )}
          </div>
        </section>
        <section className="card stat">
          <div className="stat-title">
            <span>Symptom screening</span>
            <span className="icon-box lavender">
              <Wind size={18} />
            </span>
          </div>
          <div className="stat-number word">
            {score?.distress ?? "Not taken"}
          </div>
          <p>
            PHQ-4 ·{" "}
            {score ? `${score.phqTotal} of 12` : "Your first screen awaits"}
          </p>
          <div className="stat-foot">
            <span>Higher scores reflect more symptoms</span>
          </div>
        </section>
        <section className="card stat">
          <div className="stat-title">
            <span>Average sleep</span>
            <span className="icon-box peach-bg">
              <Moon size={18} />
            </span>
          </div>
          <div className="stat-number">
            {sleep ?? "—"}
            <small>hrs</small>
          </div>
          <p>
            Over {recent.length} recorded {recent.length === 1 ? "day" : "days"}{" "}
            this week
          </p>
          <div className="stat-foot">
            <span>Rest is part of the picture</span>
          </div>
        </section>
        <section className="card stat">
          <div className="stat-title">
            <span>Days you checked in</span>
            <span className="icon-box cream">
              <CalendarDays size={18} />
            </span>
          </div>
          <div className="stat-number">
            {recent.length}
            <small>/ 7 days</small>
          </div>
          <p>This week, including today</p>
          <div className="stat-foot">
            <span>
              {today
                ? "You made time for yourself today"
                : "You can begin again any day"}
            </span>
          </div>
        </section>
      </div>
      <div className="dashboard-middle">
        <TrendChart data={data} />
        <section className="card checkin-prompt">
          <span className="icon-box sage">
            <Sun size={22} />
          </span>
          <span className="eyebrow">YOUR DAILY MOMENT</span>
          <h2>
            {today
              ? "You showed up for yourself."
              : "How are you feeling today?"}
          </h2>
          <p>
            {today
              ? "Your check-in is saved. Come back whenever you need a moment to reflect."
              : "There’s no right or wrong answer. Just a little honesty with yourself."}
          </p>
          <div className="mood-preview" aria-hidden="true">
            <span>☹</span>
            <span>◔</span>
            <span>◡</span>
            <span>☺</span>
            <span>☀</span>
          </div>
          <button className="button primary" onClick={startCheckin}>
            {today ? "Review check-in" : "Add a check-in"}
            <ArrowRight size={16} />
          </button>
          <span className="small muted">About a minute. All yours.</span>
        </section>
      </div>
      <div className="section-head">
        <div>
          <h2>A little something for you</h2>
          <p>Small things to try, at your own pace.</p>
        </div>
        <button className="text-button" onClick={() => navigate("For you")}>
          View all
          <ArrowRight size={15} />
        </button>
      </div>
      <div className="ideas-grid">
        {ideas.map((idea, i) => (
          <button
            className="card idea-preview"
            key={idea.id}
            onClick={() => navigate("For you")}
          >
            <div className={`idea-art ${i ? "warm" : "green"}`}>
              {i ? (
                <Sun size={42} strokeWidth={1} />
              ) : (
                <Wind size={42} strokeWidth={1} />
              )}
            </div>
            <div>
              <span className="eyebrow">
                {idea.category} · {idea.minutes}
              </span>
              <h3>{idea.title}</h3>
              <p>{idea.description}</p>
            </div>
            <ArrowRight className="idea-arrow" size={18} />
          </button>
        ))}
      </div>
      <section className="assessment-reminder">
        <div className="icon-box sage">
          <ClipboardList size={22} />
        </div>
        <div>
          <h3>
            {latest
              ? "A bigger picture, every two weeks"
              : "Get to know your starting point"}
          </h3>
          <p>
            {latest
              ? "Reflect on the past two weeks with a short assessment."
              : "Nine questions can help you reflect on your recent well-being."}
          </p>
        </div>
        <button
          className="button secondary"
          onClick={() => navigate("Assessments")}
        >
          View assessments
          <ArrowRight size={15} />
        </button>
      </section>
    </>
  );
}

export function Suggestions({
  data,
  toggle,
}: {
  data: AppData;
  toggle: (id: string) => void;
}) {
  return (
    <>
      <div className="page-intro">
        <span className="eyebrow">SMALL STEPS, YOUR PACE</span>
        <h2>A little something for you</h2>
        <p>
          Choose an activity that feels right today. These are general self-care
          ideas, not treatment.
        </p>
      </div>
      <div className="suggestions-grid">
        {recommendations(data).map((r, i) => {
          const done = data.actions.some((a) => a.id === r.id && a.completed);
          return (
            <section key={r.id} className="card suggestion">
              <span className={`icon-box ${i % 2 ? "peach-bg" : "sage"}`}>
                <Sparkles size={22} />
              </span>
              <span className="eyebrow">
                {r.category} · {r.minutes}
              </span>
              <h2>{r.title}</h2>
              <p>{r.description}</p>
              <div className="why">
                <strong>Why this is here</strong>
                <p>{r.reason}</p>
              </div>
              <button
                className={`button ${done ? "secondary" : "primary"}`}
                aria-pressed={done}
                onClick={() => toggle(r.id)}
              >
                {done ? (
                  <>
                    <Check size={16} />
                    Tried it · undo
                  </>
                ) : (
                  "Mark as tried"
                )}
              </button>
            </section>
          );
        })}
      </div>
      <p className="footnote">
        These general self-care suggestions have not been clinically reviewed.
        Persistent or troubling symptoms deserve professional support,
        regardless of a score.
      </p>
    </>
  );
}
