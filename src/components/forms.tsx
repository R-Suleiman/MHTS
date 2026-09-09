"use client";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Heart,
} from "lucide-react";
import {
  ASSESSMENT_VERSION,
  PHQ_OPTIONS,
  PHQ_QUESTIONS,
  scoreAssessment,
  WHO_OPTIONS,
  WHO_QUESTIONS,
} from "@/lib/assessments";
import {
  AppData,
  Assessment,
  Checkin,
  latestAssessment,
  localDay,
  prettyDate,
} from "@/lib/data";

export function CheckinForm({
  existing,
  onSave,
  onCancel,
}: {
  existing?: Checkin;
  onSave: (entry: Checkin) => void;
  onCancel: () => void;
}) {
  const [mood, setMood] = useState<number | null>(existing?.mood ?? null);
  const [tags, setTags] = useState(existing?.tags ?? []);
  const [error, setError] = useState("");
  const moods = ["Very low", "Low", "Okay", "Good", "Very good"];
  return (
    <section className="card form-card">
      <span className="eyebrow">{prettyDate(localDay())} · DAILY CHECK-IN</span>
      <h2>Meet yourself where you are.</h2>
      <p>
        These personal ratings help you reflect. They aren’t clinical
        assessments.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (mood === null) {
            setError("Choose a mood before saving your check-in.");
            return;
          }
          const form = new FormData(e.currentTarget);
          onSave({
            id: existing?.id ?? crypto.randomUUID(),
            date: localDay(),
            mood,
            stress: Number(form.get("stress")),
            energy: Number(form.get("energy")),
            sleep: Number(form.get("sleep")),
            tags,
            note: String(form.get("note")).trim(),
          });
        }}
      >
        <fieldset>
          <legend>How is your mood today?</legend>
          <div className="mood-options">
            {moods.map((label, i) => (
              <label
                className={`mood-option ${mood === i + 1 ? "selected" : ""}`}
                key={label}
              >
                <input
                  type="radio"
                  name="mood"
                  value={i + 1}
                  checked={mood === i + 1}
                  onChange={() => {
                    setMood(i + 1);
                    setError("");
                  }}
                />
                <span className="mood-face" aria-hidden="true">
                  {["☹", "◔", "◡", "☺", "☀"][i]}
                </span>
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="form-columns">
          <label className="field">
            Stress level
            <select
              name="stress"
              defaultValue={existing?.stress ?? ""}
              required
            >
              <option value="" disabled>
                Select stress level
              </option>
              {["Very low", "Low", "Moderate", "High", "Very high"].map(
                (s, i) => (
                  <option key={s} value={i + 1}>
                    {i + 1} — {s}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="field">
            Energy level
            <select
              name="energy"
              defaultValue={existing?.energy ?? ""}
              required
            >
              <option value="" disabled>
                Select energy level
              </option>
              {["Very low", "Low", "Moderate", "High", "Very high"].map(
                (s, i) => (
                  <option key={s} value={i + 1}>
                    {i + 1} — {s}
                  </option>
                ),
              )}
            </select>
          </label>
        </div>
        <label className="field">
          How many hours did you sleep last night?
          <input
            type="number"
            name="sleep"
            min={0}
            max={24}
            step={0.5}
            required
            defaultValue={existing?.sleep ?? ""}
            placeholder="e.g. 7.5"
          />
        </label>
        <fieldset>
          <legend>
            What’s been part of your day?{" "}
            <span className="muted small">Optional</span>
          </legend>
          <div className="tags">
            {[
              "Work",
              "Studies",
              "Family",
              "Friends",
              "Time outside",
              "Movement",
              "Rest",
              "Relationships",
            ].map((tag) => (
              <button
                type="button"
                key={tag}
                className={`tag ${tags.includes(tag) ? "selected" : ""}`}
                aria-pressed={tags.includes(tag)}
                onClick={() =>
                  setTags(
                    tags.includes(tag)
                      ? tags.filter((t) => t !== tag)
                      : [...tags, tag],
                  )
                }
              >
                {tag}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="field">
          Anything else on your mind?{" "}
          <span className="muted small">Optional · up to 500 characters</span>
          <textarea
            name="note"
            maxLength={500}
            rows={3}
            defaultValue={existing?.note ?? ""}
            placeholder="A small win, a difficult moment, or anything you’d like to remember…"
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button className="button secondary" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="button primary" type="submit">
            {existing ? "Update check-in" : "Save check-in"}
            <Check size={16} />
          </button>
        </div>
      </form>
    </section>
  );
}

export function Assessments({
  data,
  onSave,
  onStart,
  active,
  onCancel,
}: {
  data: AppData;
  onSave: (record: Assessment) => Promise<boolean>;
  onStart: () => void;
  active: boolean;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(
    Array(9).fill(null),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Assessment | null>(null);
  const last = latestAssessment(data);
  const score = result || last ? scoreAssessment((result || last)!) : null;
  const start = () => {
    setStep(0);
    setAnswers(Array(9).fill(null));
    setResult(null);
    setError("");
    onStart();
  };
  async function submit() {
    if (answers.some((a) => a === null)) {
      setError("Please answer every question before submitting.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const who = answers.slice(0, 5) as number[];
      const phq = answers.slice(5) as number[];
      const response = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ who, phq }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok)
        throw new Error("Scoring could not be completed. Please try again.");
      const record: Assessment = {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        version: ASSESSMENT_VERSION,
        who,
        phq,
      };
      if (await onSave(record)) {
        setResult(record);
        onCancel();
      }
    } catch {
      setError(
        "We couldn’t reach the scoring service. Your answers are still here; please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (active) {
    const who = step < 5;
    const options = who ? WHO_OPTIONS : PHQ_OPTIONS;
    const question = who ? WHO_QUESTIONS[step] : PHQ_QUESTIONS[step - 5];
    return (
      <section className="card form-card questionnaire">
        <div className="section-head">
          <span className="eyebrow">
            {who ? "WHO-5 · WELL-BEING" : "PHQ-4 · SYMPTOM SCREENING"}
          </span>
          <span className="small muted">{step + 1} of 9</span>
        </div>
        <progress max={9} value={step + 1} aria-label="Assessment progress" />
        <p className="recall">
          {who
            ? "Please indicate for each of the five statements which is closest to how you have been feeling over the last two weeks. Notice that higher numbers mean better well-being."
            : "Over the last two weeks, how often have you been bothered by the following problems?"}
        </p>
        <fieldset key={step}>
          <legend className="question-title">{question}</legend>
          <div className="answer-options">
            {options.map((option, i) => (
              <label
                key={option}
                className={`answer-option ${answers[step] === i ? "selected" : ""}`}
              >
                <input
                  type="radio"
                  name={`question-${step}`}
                  checked={answers[step] === i}
                  onChange={() =>
                    setAnswers((prev) =>
                      prev.map((v, index) => (index === step ? i : v)),
                    )
                  }
                />
                <span>{option}</span>
                <span className="answer-value">{i}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <p className="small muted">
          You can go back and change your answers before saving.
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => (step ? setStep(step - 1) : onCancel())}
          >
            <ArrowLeft size={16} />
            {step ? "Back" : "Cancel"}
          </button>
          <button
            className="button primary"
            disabled={answers[step] === null || busy}
            onClick={() => (step < 8 ? setStep(step + 1) : void submit())}
          >
            {busy ? "Saving…" : step < 8 ? "Continue" : "See my results"}
            <ArrowRight size={16} />
          </button>
        </div>
        <Sources />
      </section>
    );
  }
  return (
    <>
      <div className="page-intro">
        <span className="eyebrow">LOOKING AT THE BIGGER PICTURE</span>
        <h2>
          {result ? "Thank you for checking in." : "A moment to reflect."}
        </h2>
        <p>
          These two short questionnaires ask about your last two weeks. Results
          offer a starting point for reflection and conversation.
        </p>
      </div>
      {result && (
        <div role="status" className="notice success">
          <CheckCircle2 size={20} />
          <p>Your assessment has been saved to your history.</p>
        </div>
      )}
      <div className="assessment-cards">
        <section className="card">
          <span className="pill">5 questions</span>
          <h2>General well-being</h2>
          <p>The WHO-5 explores positive feelings and everyday well-being.</p>
          <span className="eyebrow">WHO-5 · PAST TWO WEEKS</span>
        </section>
        <section className="card">
          <span className="pill lavender">4 questions</span>
          <h2>Anxiety & depressive symptoms</h2>
          <p>
            The PHQ-4 is a short symptom screen. It cannot establish a
            diagnosis.
          </p>
          <span className="eyebrow">PHQ-4 · PAST TWO WEEKS</span>
        </section>
      </div>
      <div className="assessment-start">
        <button className="button primary" onClick={start}>
          {last ? "Take a new assessment" : "Start my first assessment"}
          <ArrowRight size={16} />
        </button>
        <p className="small muted">
          About 3 minutes · suggested every two weeks
          {last ? ` · last taken ${prettyDate(last.date)}` : ""}
        </p>
      </div>
      {score && (
        <section className="card results">
          <h2>{result ? "Your results" : "Your latest results"}</h2>
          <p className="small muted">
            {prettyDate((result || last)!.date)} · Higher WHO-5 scores reflect
            better reported well-being. Higher PHQ-4 scores reflect more
            symptoms.
          </p>
          <div className="result-grid">
            <div>
              <span>WHO-5 well-being</span>
              <strong>
                {score.wellbeing}
                <small> / 100</small>
              </strong>
              <p>
                {score.wellbeing < 50
                  ? "Your reported well-being is below the suggested screening threshold. Consider a professional assessment."
                  : "Your score is above the suggested screening threshold. This does not rule out mental health difficulties."}
              </p>
            </div>
            <div>
              <span>PHQ-4 symptoms</span>
              <strong>
                {score.phqTotal}
                <small> / 12</small>
              </strong>
              <p>
                {score.distress} range of reported psychological distress. This
                is a screening category, not a diagnosis.
              </p>
            </div>
            <div>
              <span>Anxiety subscale</span>
              <strong>
                {score.anxiety}
                <small> / 6</small>
              </strong>
              <p>
                {score.anxiety >= 3
                  ? "Further assessment for anxiety may be helpful."
                  : "Below the screening threshold; seek support if symptoms concern you."}
              </p>
            </div>
            <div>
              <span>Depression subscale</span>
              <strong>
                {score.depression}
                <small> / 6</small>
              </strong>
              <p>
                {score.depression >= 3
                  ? "Further assessment for depression may be helpful."
                  : "Below the screening threshold; seek support if symptoms concern you."}
              </p>
            </div>
          </div>
          <div className="notice">
            <Heart size={20} />
            <p>
              A score is only part of your story. If symptoms persist, affect
              daily life, or worry you, speak with a qualified health
              professional regardless of these results.
            </p>
          </div>
        </section>
      )}
      <Sources />
    </>
  );
}

export function Sources() {
  return (
    <details className="sources">
      <summary>About these questionnaires & sources</summary>
      <p>
        WHO-5: World Health Organization. The World Health Organization-Five
        Well-Being Index (WHO-5). Geneva: WHO; 2024. © WHO 2024.{" "}
        <a
          href="https://www.who.int/publications/m/item/WHO-UCN-MSD-MHE-2024.01"
          target="_blank"
          rel="noreferrer"
        >
          Original questionnaire
        </a>{" "}
        ·{" "}
        <a
          href="https://creativecommons.org/licenses/by-nc-sa/3.0/igo/"
          target="_blank"
          rel="noreferrer"
        >
          CC BY-NC-SA 3.0 IGO
        </a>
        . Presented as individual questions with response options in ascending
        order. No WHO endorsement is implied.
      </p>
      <p>
        PHQ-4: Kroenke, Spitzer, Williams & Löwe (2009).{" "}
        <a
          href="https://www.oregon.gov/oha/HPA/dsi-pmc/PainCareToolbox/PHQ-4.pdf"
          target="_blank"
          rel="noreferrer"
        >
          Questionnaire and scoring reference
        </a>
        . Totals: 0–2 minimal (originally “normal”), 3–5 mild, 6–8 moderate,
        9–12 severe. Either subscale ≥3 suggests further assessment. WHO-5 raw
        total ×4; below 50 suggests further assessment.
      </p>
      <p>
        Questionnaire wording is retained; presentation adapted. These
        instruments do not assess every condition or establish safety. Results
        can support a conversation with a qualified professional.
      </p>
    </details>
  );
}
