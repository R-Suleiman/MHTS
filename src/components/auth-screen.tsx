"use client";
import { useState } from "react";
import { ArrowRight, Eye, EyeOff, Leaf, LockKeyhole } from "lucide-react";

export function notifyAuthChange() {
  try {
    localStorage.setItem("mhts-auth-change", crypto.randomUUID());
  } catch {
    /* API authorization remains effective without browser storage. */
  }
}

export function AuthScreen({
  onAuthenticated,
  initialError = "",
}: {
  onAuthenticated: () => void;
  initialError?: string;
}) {
  const [register, setRegister] = useState(false);
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="brand">
          <span className="brand-mark">
            <Leaf size={26} />
          </span>
          <span>
            MHTS<small>A little more in tune.</small>
          </span>
        </div>
        <div>
          <span className="eyebrow">YOUR SPACE TO GROW</span>
          <h1>
            A little awareness.
            <br />A little more balance.
          </h1>
          <p>
            Notice how you feel, understand your patterns, and make room for
            small steps forward.
          </p>
          <div className="auth-benefits">
            <span>01 · Check in with yourself</span>
            <span>02 · See your progress over time</span>
            <span>03 · Find a next step that fits</span>
          </div>
        </div>
        <p className="small">Made for reflection. Built with care.</p>
      </section>
      <section className="auth-panel">
        <div className="card auth-card">
          <span className="icon-box sage">
            <LockKeyhole size={23} />
          </span>
          <h2>{register ? "Make this your space." : "Welcome back."}</h2>
          <p>
            {register
              ? "Create an account to start your well-being journey."
              : "Sign in to pick up where you left off."}
          </p>
          <form
            key={register ? "register" : "login"}
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              const values = new FormData(e.currentTarget);
              setError("");
              setBusy(true);
              try {
                const response = await fetch("/api/auth", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: register ? "register" : "login",
                    email: values.get("email"),
                    password: values.get("password"),
                    name: values.get("name"),
                    adult: values.get("adult") === "on",
                    claimLegacy: values.get("claimLegacy") === "on",
                  }),
                  signal: AbortSignal.timeout(20000),
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error);
                notifyAuthChange();
                onAuthenticated();
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : "Could not sign in. Please try again.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <fieldset disabled={busy} className="auth-fields">
              {register && (
                <label className="field">
                  Preferred name
                  <input
                    name="name"
                    required
                    maxLength={40}
                    autoComplete="given-name"
                    placeholder="Your name"
                  />
                </label>
              )}
              <label className="field">
                Email address
                <input
                  name="email"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="username"
                  placeholder="you@example.com"
                />
              </label>
              <div className="field">
                <label htmlFor="auth-password">Password</label>
                <div className="password-input">
                  <input
                    id="auth-password"
                    aria-describedby={register ? "password-help" : undefined}
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={register ? 15 : 1}
                    maxLength={128}
                    autoComplete={
                      register ? "new-password" : "current-password"
                    }
                  />
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {register && (
                  <span id="password-help" className="small muted">
                    Use 15–128 characters. A memorable passphrase works well.
                  </span>
                )}
              </div>
              {register && (
                <>
                  <label className="checkbox">
                    <input name="adult" type="checkbox" required />I am 18 or
                    older. I understand that MHTS supports reflection and
                    screening, and does not provide a diagnosis or emergency
                    care.
                  </label>
                  <label className="checkbox">
                    <input name="claimLegacy" type="checkbox" />
                    Attach my existing MHTS browser profile, if one is available
                    on this device.
                  </label>
                </>
              )}
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <button className="button primary" type="submit">
                {busy
                  ? "Please wait…"
                  : register
                    ? "Create account"
                    : "Sign in"}
                <ArrowRight size={16} />
              </button>
            </fieldset>
          </form>
          <div className="auth-switch">
            <span>
              {register ? "Already have an account?" : "New to MHTS?"}
            </span>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                setRegister(!register);
                setError("");
                setShowPassword(false);
              }}
            >
              {register ? "Sign in instead" : "Create an account"}
            </button>
          </div>
          <p className="small muted">
            Your records follow your account. Sign out when using a shared
            device.
          </p>
        </div>
      </section>
    </main>
  );
}

export function AccountSecurity({
  email,
  onDeleted,
}: {
  email: string;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(form: HTMLFormElement, action: "password" | "delete") {
    if (busy) return;
    const values = new FormData(form);
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          currentPassword: values.get("currentPassword"),
          newPassword: values.get("newPassword"),
        }),
        signal: AbortSignal.timeout(20000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      notifyAuthChange();
      if (action === "delete") onDeleted();
      else {
        form.reset();
        setMessage("Password changed. Other sessions have been signed out.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="account-security">
      <h3>Account security</h3>
      <p>
        Signed in as <strong>{email}</strong>
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(e.currentTarget, "password");
        }}
      >
        <fieldset disabled={busy} className="auth-fields">
          <label className="field">
            Current password
            <input
              name="currentPassword"
              type="password"
              required
              maxLength={128}
              autoComplete="current-password"
            />
          </label>
          <label className="field">
            New password
            <input
              name="newPassword"
              type="password"
              required
              minLength={15}
              maxLength={128}
              autoComplete="new-password"
            />
            <span className="small muted">15–128 characters</span>
          </label>
          <button className="button secondary">Change password</button>
        </fieldset>
      </form>
      <details className="account-delete">
        <summary>Delete my account permanently</summary>
        <p>
          This removes your account, assessments, check-ins, and activities, and
          signs out every session. Export your records first if you want a copy.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(e.currentTarget, "delete");
          }}
        >
          <fieldset disabled={busy} className="auth-fields">
            <label className="field">
              Confirm with your password
              <input
                name="currentPassword"
                type="password"
                required
                maxLength={128}
                autoComplete="current-password"
              />
            </label>
            <label className="checkbox">
              <input type="checkbox" required />I understand that my account and
              records will be deleted.
            </label>
            <button className="button danger">
              Delete account permanently
            </button>
          </fieldset>
        </form>
      </details>
      {message && (
        <p role="status" className="notice success">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
