"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardList,
  Download,
  Heart,
  HelpCircle,
  LayoutDashboard,
  Leaf,
  Menu,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Overview, Suggestions, TrendChart, View } from "./dashboard";
import { Assessments, CheckinForm, Sources } from "./forms";
import {
  AppData,
  Assessment,
  dataSchema,
  emptyData,
  localDay,
  prettyDate,
  STORAGE_KEY,
  upsertCheckin,
} from "@/lib/data";
import { AuthScreen, AccountSecurity, notifyAuthChange } from "./auth-screen";
import { scoreAssessment } from "@/lib/assessments";

const navigation = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Assessments", icon: ClipboardList },
  { name: "Daily check-in", icon: Heart },
  { name: "My history", icon: CalendarDays },
  { name: "For you", icon: Sparkles },
] as const;
export function App() {
  const [data, setData] = useState<AppData>(emptyData);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("Overview");
  const [assessmentActive, setAssessmentActive] = useState(false);
  const [menu, setMenu] = useState(false);
  const [notice, setNotice] = useState("");
  const [storageError, setStorageError] = useState("");
  const [confirm, setConfirm] = useState<"delete" | "leave" | null>(null);
  const [pendingView, setPendingView] = useState<View | null>(null);
  const [authVersion, setAuthVersion] = useState(0);
  const revision = useRef(0);
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [legacy, setLegacy] = useState<AppData | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/auth", { cache: "no-store" });
        const result = await response.json();
        if (response.status === 401) return;
        if (!response.ok) throw new Error(result.error);
        if (cancelled) return;
        const loaded = dataSchema.parse(result.data);
        revision.current = result.revision;
        setData(loaded);
        setUser(result.user);
        try {
          const previous = localStorage.getItem(STORAGE_KEY);
          if (
            previous &&
            !loaded.checkins.length &&
            !loaded.assessments.length
          ) {
            const parsed = dataSchema.safeParse(JSON.parse(previous));
            if (parsed.success && parsed.data.profile) setLegacy(parsed.data);
          }
        } catch {
          /* Legacy storage is optional; never overwrite unreadable records. */
        }
      } catch (error) {
        if (!cancelled)
          setStorageError(
            error instanceof Error
              ? error.message
              : "Could not load database records.",
          );
      } finally {
        if (!cancelled) setReady(true);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [authVersion]);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key !== "mhts-auth-change") return;
      setUser(null);
      setData(emptyData());
      setLegacy(null);
      setStorageError("");
      setReady(false);
      setAuthVersion((v) => v + 1);
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!confirm) return;
    const dialog = document.getElementById(
      "confirmation",
    ) as HTMLDialogElement | null;
    dialog?.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, [confirm]);
  useEffect(() => {
    if (!assessmentActive && view !== "Daily check-in") return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [assessmentActive, view]);

  async function save(next: AppData) {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    try {
      const response = await fetch("/api/data", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: next,
          revision: revision.current,
          accountId: user?.id,
        }),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (response.status === 401) {
        setUser(null);
        setData(emptyData());
      }
      if (!response.ok) throw new Error(result.error);
      revision.current = result.revision;
      const saved = dataSchema.parse(result.data);
      setData(saved);
      setStorageError("");
      return true;
    } catch (error) {
      setStorageError(
        error instanceof Error
          ? error.message
          : "Your change was not confirmed. Retry or reload to check your records.",
      );
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  async function importLegacy() {
    if (!legacy || data.checkins.length || data.assessments.length) return;
    if (await save(legacy)) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* DB copy succeeded; old copy can be removed in browser settings. */
      }
      setLegacy(null);
      setNotice(
        "Your earlier browser records have been imported into the database.",
      );
    }
  }
  function navigate(next: View, force = false) {
    if (savingRef.current) return;
    if (
      !force &&
      (assessmentActive || view === "Daily check-in") &&
      next !== view
    ) {
      setPendingView(next);
      setConfirm("leave");
      return;
    }
    setView(next);
    setMenu(false);
    setAssessmentActive(false);
    window.scrollTo({ top: 0 });
  }
  function requireProfile(next: View) {
    navigate(next);
  }
  async function logout() {
    if (savingRef.current) return;
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
      if (!response.ok)
        throw new Error("Could not sign out. Please try again.");
      notifyAuthChange();
      window.location.reload();
    } catch (error) {
      setStorageError(
        error instanceof Error ? error.message : "Could not sign out.",
      );
    }
  }
  function exportData() {
    const contents = JSON.stringify(data, null, 2);
    const blob = new Blob([contents], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mhts-${localDay()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Export downloaded. It contains your saved entries.");
  }
  async function deleteData() {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const response = await fetch("/api/data", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revision: revision.current,
          accountId: user?.id,
        }),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (response.status === 401) {
        setUser(null);
        setData(emptyData());
      }
      if (!response.ok) throw new Error(result.error);
      revision.current = result.revision;
      setData(dataSchema.parse(result.data));
      setLegacy(null);
      setStorageError("");
      setConfirm(null);
      setView("Overview");
      setNotice(
        "Your tracking history has been cleared. Your account is unchanged.",
      );
    } catch (error) {
      setStorageError(
        error instanceof Error
          ? error.message
          : "Deletion was not confirmed. Reload to check your records.",
      );
      setConfirm(null);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  function saveAssessment(record: Assessment) {
    return save({ ...data, assessments: [...data.assessments, record] });
  }
  const greeting =
    new Date().getHours() < 12
      ? "Good morning"
      : new Date().getHours() < 18
        ? "Good afternoon"
        : "Good evening";
  if (!ready)
    return (
      <main className="loading">
        <Leaf size={38} />
        <p>Making a little space for you…</p>
      </main>
    );
  if (!user)
    return (
      <AuthScreen
        initialError={storageError}
        onAuthenticated={() => window.location.reload()}
      />
    );
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      {menu && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("Overview");
          }}
        >
          <span className="brand-mark">
            <Leaf size={24} />
          </span>
          <span>
            MHTS<small>A little more in tune.</small>
          </span>
        </a>
        <div className="sidebar-label">YOUR SPACE</div>
        <nav aria-label="Main navigation">
          {navigation.map((item) => (
            <button
              key={item.name}
              className={`nav-link ${view === item.name ? "active" : ""}`}
              aria-current={view === item.name ? "page" : undefined}
              onClick={() =>
                item.name === "Daily check-in"
                  ? requireProfile(item.name)
                  : navigate(item.name)
              }
            >
              <item.icon size={19} />
              <span>{item.name}</span>
              {view === item.name && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-quote">
            <div className="quote-leaves">
              <Leaf size={30} strokeWidth={1.2} />
            </div>
            <p>
              Progress looks different
              <br />
              for everyone.
            </p>
            <span>Take it one day at a time.</span>
          </div>
          <button
            className={`nav-link ${view === "Get support" ? "active" : ""}`}
            onClick={() => navigate("Get support")}
          >
            <HelpCircle size={19} />
            Get support
          </button>
          <button
            className={`nav-link ${view === "Settings" ? "active" : ""}`}
            onClick={() => navigate("Settings")}
          >
            <Settings size={19} />
            Settings
          </button>
          <button className="nav-link" disabled={saving} onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              <Menu size={22} />
            </button>
            <span>Your space</span>
            <ChevronRight size={13} />
            <strong>{view}</strong>
          </div>
          <div className="topbar-right">
            <span className="local-badge">
              <ShieldCheck size={14} />
              Your account
            </span>
            <button
              className="avatar"
              aria-label="Open profile settings"
              onClick={() => navigate("Settings")}
            >
              {data.profile?.name.charAt(0).toUpperCase() ?? "Y"}
            </button>
          </div>
        </header>
        <main id="main" className="main-content">
          <div className="page-heading">
            <div>
              <h1>
                {view === "Overview"
                  ? `${greeting}${data.profile ? `, ${data.profile.name}` : ""}`
                  : view}
                <span className="heading-dot">.</span>
              </h1>
              <p>
                {view === "Overview"
                  ? "A little awareness today. A little more balance tomorrow."
                  : "A space for reflection, one step at a time."}
              </p>
            </div>
            <span className="date-label">
              <CalendarDays size={15} />
              {new Date().toLocaleDateString("en", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
          {storageError && (
            <div role="alert" className="notice error">
              <p>{storageError}</p>
              <button
                className="text-button"
                onClick={() => window.location.reload()}
              >
                Reload saved records
              </button>
              <button
                className="text-button"
                onClick={() => navigate("Settings")}
              >
                Settings
              </button>
            </div>
          )}
          {legacy && !data.checkins.length && !data.assessments.length && (
            <div className="notice">
              <p>We found records saved by the earlier browser-only version.</p>
              <button
                className="button secondary"
                disabled={saving}
                onClick={importLegacy}
              >
                Import previous records
              </button>
            </div>
          )}
          {saving && <p role="status">Saving to database…</p>}
          <fieldset disabled={saving}>
            <>
              {view === "Overview" && (
                <Overview
                  data={data}
                  navigate={navigate}
                  startCheckin={() => requireProfile("Daily check-in")}
                />
              )}
              {view === "Daily check-in" && (
                <CheckinForm
                  existing={data.checkins.find((c) => c.date === localDay())}
                  onSave={async (entry) => {
                    if (await save(upsertCheckin(data, entry))) {
                      navigate("Overview", true);
                      setNotice(
                        "Your check-in is saved. Thanks for making time for yourself.",
                      );
                    }
                  }}
                  onCancel={() => navigate("Overview", true)}
                />
              )}
              {view === "Assessments" && (
                <Assessments
                  data={data}
                  onSave={saveAssessment}
                  active={assessmentActive}
                  onStart={() => {
                    setAssessmentActive(true);
                  }}
                  onCancel={() => setAssessmentActive(false)}
                />
              )}
              {view === "For you" && (
                <Suggestions
                  data={data}
                  toggle={async (id) => {
                    const done = data.actions.find(
                      (a) => a.id === id,
                    )?.completed;
                    if (
                      await save({
                        ...data,
                        actions: [
                          ...data.actions.filter((a) => a.id !== id),
                          { id, completed: !done },
                        ],
                      })
                    )
                      setNotice(
                        done
                          ? "Activity marked as not tried."
                          : "Activity marked as tried. Small steps count.",
                      );
                  }}
                />
              )}
              {view === "My history" && (
                <History
                  data={data}
                  onExport={exportData}
                  onAssess={() => navigate("Assessments")}
                />
              )}
              {view === "Settings" && (
                <section className="card settings-card">
                  <h2>Your profile & data</h2>
                  <p>
                    Manage your profile, password, and saved records. Sign in on
                    another device to continue where you left off.
                  </p>
                  {data.profile && (
                    <form
                      key={data.profile.name}
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const name = String(
                          new FormData(e.currentTarget).get("name"),
                        ).trim();
                        if (
                          await save({
                            ...data,
                            profile: { ...data.profile!, name },
                          })
                        )
                          setNotice("Profile updated.");
                      }}
                    >
                      <label className="field">
                        Preferred name
                        <input
                          name="name"
                          required
                          maxLength={40}
                          pattern=".*\S.*"
                          defaultValue={data.profile.name}
                        />
                      </label>
                      <button className="button primary">
                        Save profile
                        <Check size={15} />
                      </button>
                    </form>
                  )}
                  <hr />
                  <div className="settings-row">
                    <div>
                      <h3>Export your records</h3>
                      <p>
                        Download a JSON file of your profile, responses,
                        check-ins, and activities.
                      </p>
                    </div>
                    <button className="button secondary" onClick={exportData}>
                      <Download size={16} />
                      Export data
                    </button>
                  </div>
                  <div className="settings-row">
                    <div>
                      <h3>Clear tracking history</h3>
                      <p>
                        Remove your assessments, check-ins, and activities. Your
                        account and profile remain. This cannot be undone.
                      </p>
                    </div>
                    <button
                      className="button danger"
                      onClick={() => setConfirm("delete")}
                    >
                      <Trash2 size={16} />
                      Delete data
                    </button>
                  </div>
                  <div className="notice">
                    <ShieldCheck size={23} />
                    <p>
                      Sign out on shared devices. Your records are linked to
                      your account and remain available when you sign in again.
                    </p>
                  </div>
                  <AccountSecurity
                    email={user.email}
                    onDeleted={() => window.location.reload()}
                  />
                  <Sources />
                </section>
              )}
              {view === "Get support" && <Support />}
            </>
          </fieldset>
          <footer className="page-footer">
            <span>
              <Leaf size={14} /> Made for reflection. Built with care.
            </span>
            <span>For reflection and screening. Not a diagnosis.</span>
          </footer>
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          <CheckCircleIcon />
          <span>{notice}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {confirm && (
        <dialog
          id="confirmation"
          className="confirmation"
          onCancel={() => setConfirm(null)}
        >
          <h2>
            {confirm === "delete"
              ? "Delete these records?"
              : "Leave this form?"}
          </h2>
          <p>
            {confirm === "delete"
              ? "Assessment answers, check-ins, and activities will be removed. Your account and profile remain. Export first if you want a copy."
              : "Unsaved answers on this form will be lost."}
          </p>
          <div className="form-actions">
            <button
              className="button secondary"
              autoFocus
              onClick={() => setConfirm(null)}
            >
              Keep {confirm === "delete" ? "data" : "editing"}
            </button>
            <button
              className={`button ${confirm === "delete" ? "danger" : "primary"}`}
              onClick={() => {
                if (confirm === "delete") deleteData();
                else {
                  setConfirm(null);
                  if (pendingView) navigate(pendingView, true);
                }
              }}
            >
              {confirm === "delete" ? "Delete permanently" : "Leave form"}
            </button>
          </div>
        </dialog>
      )}
    </div>
  );
}
function CheckCircleIcon() {
  return (
    <span className="toast-icon">
      <Check size={17} />
    </span>
  );
}
function History({
  data,
  onExport,
  onAssess,
}: {
  data: AppData;
  onExport: () => void;
  onAssess: () => void;
}) {
  const [tab, setTab] = useState("Check-ins");
  return (
    <>
      <div className="section-head">
        <div>
          <h2>Your story, over time</h2>
          <p>Look back with curiosity, without judging any single day.</p>
        </div>
        <button className="button secondary" onClick={onExport}>
          <Download size={16} />
          Export history
        </button>
      </div>
      <TrendChart data={data} />
      <section className="card history-card">
        <div className="tabs" role="group" aria-label="History type">
          {["Check-ins", "Assessments"].map((t) => (
            <button
              key={t}
              className={tab === t ? "selected" : ""}
              aria-pressed={tab === t}
              onClick={() => setTab(t)}
            >
              {t}
              <span>
                {t === "Check-ins"
                  ? data.checkins.length
                  : data.assessments.length}
              </span>
            </button>
          ))}
        </div>
        {tab === "Check-ins" ? (
          data.checkins.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Mood / 5</th>
                    <th>Stress / 5</th>
                    <th>Energy / 5</th>
                    <th>Sleep</th>
                    <th>Reflection</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.checkins]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((c) => (
                      <tr key={c.id}>
                        <td>{prettyDate(c.date)}</td>
                        <td>
                          <span className="pill">{c.mood}</span>
                        </td>
                        <td>{c.stress}</td>
                        <td>{c.energy}</td>
                        <td>{c.sleep} hrs</td>
                        <td className="note-cell">
                          {c.tags.length > 0 && (
                            <span className="small muted">
                              {c.tags.join(" · ")}
                            </span>
                          )}
                          {c.note && <p>{c.note}</p>}
                          {!c.tags.length && !c.note && "—"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-chart">
              <Heart size={28} />
              <h3>No check-ins yet</h3>
              <p>Your daily entries will appear here after you save them.</p>
            </div>
          )
        ) : data.assessments.length ? (
          <div className="assessment-history">
            {[...data.assessments]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((a) => {
                const score = scoreAssessment(a);
                return (
                  <details key={a.id}>
                    <summary>
                      <span>{prettyDate(a.date)}</span>
                      <span>WHO-5: {score.wellbeing}/100</span>
                      <span>
                        PHQ-4: {score.phqTotal}/12 · {score.distress}
                      </span>
                    </summary>
                    <p>
                      Anxiety: {score.anxiety}/6 · Depression:{" "}
                      {score.depression}/6
                    </p>
                    <p>
                      WHO-5 responses: {a.who.join(", ")} · PHQ-4 responses:{" "}
                      {a.phq.join(", ")}
                    </p>
                    <p className="small muted">
                      Questionnaire version: {a.version}. These are screening
                      results, not diagnoses.
                    </p>
                  </details>
                );
              })}
          </div>
        ) : (
          <div className="empty-chart">
            <ClipboardList size={28} />
            <h3>A starting point is waiting</h3>
            <p>Complete an assessment to begin your history.</p>
            <button className="button secondary" onClick={onAssess}>
              View assessments
            </button>
          </div>
        )}
      </section>
    </>
  );
}
function Support() {
  return (
    <>
      <div className="page-intro">
        <span className="eyebrow">YOU DON’T HAVE TO DO IT ALONE</span>
        <h2>There’s room to ask for help.</h2>
        <p>
          You can seek support at any time. You don’t need a particular score or
          a diagnosis.
        </p>
      </div>
      <section className="card support-urgent">
        <h2>If you need immediate help</h2>
        <p>
          If you feel in immediate danger or unable to keep yourself safe,
          contact your local emergency services or go to the nearest emergency
          department. If possible, ask someone you trust to stay with you.
        </p>
        <p>
          This app is not monitored and cannot contact emergency services for
          you.
        </p>
      </section>
      <div className="assessment-cards">
        <section className="card">
          <span className="icon-box sage">
            <Heart size={22} />
          </span>
          <h2>Talk with someone you trust</h2>
          <p>
            A friend, family member, or someone in your community can be a
            starting point. You might say: “I haven’t been feeling like myself.
            Can we talk?”
          </p>
        </section>
        <section className="card">
          <span className="icon-box lavender">
            <HelpCircle size={22} />
          </span>
          <h2>Find professional support</h2>
          <p>
            Contact a local clinic, qualified mental health professional, or
            your university’s counseling service. Bringing your history may help
            explain what you have been experiencing.
          </p>
          <a
            className="text-button"
            href="https://www.nimh.nih.gov/health/find-help"
            target="_blank"
            rel="noreferrer"
          >
            Read about finding help
            <ArrowRight size={15} />
          </a>
          <p className="small muted">
            External NIMH resource; service listings are primarily for the
            United States. Use local services in your country.
          </p>
        </section>
      </div>
    </>
  );
}
