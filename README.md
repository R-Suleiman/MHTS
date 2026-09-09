# MHTS — Mental Health Tracking System

Next.js, TypeScript, Tailwind CSS, PostgreSQL, Recharts, and Zod. MHTS supports daily reflection, WHO-5/PHQ-4 screening, history charts, and general self-care suggestions. Demo mode is removed.

## Run locally

Your existing PostgreSQL instance is configured through the ignored `.env.local` file (database `mhts`, user `devuser`, port 5432). Keep its credentials private.

```bash
npm install
npm run db:migrate
npm run dev
```

Open http://localhost:3000 and create an account. Production-mode local testing uses `npm run build` followed by `npm start`.

An optional isolated cluster helper remains available: `npm run db:start`, `db:status`, and `db:stop` operate on the old project cluster on port 5433, not your existing PostgreSQL service. Do not use them to start the instance on port 5432. The helper needs PostgreSQL binaries on PATH or `PG_BIN` set. `.local-db/` holds its data and backups; never commit or delete it casually.

`npm run db:transfer` remains available for a one-time transfer from `SOURCE_DATABASE_URL` into an **empty** `mhts` database. It backs up the source and refuses to overwrite existing destination objects. Do not run it against your already migrated database.

## Accounts and authentication

- Email/password registration with normalized, unique email addresses and an adult acknowledgment.
- Sign-in, sign-out, signed-in profile editing, and cross-device access.
- Passwords of 15–128 characters, salted scrypt hashes (N=131072, r=8, p=1), constant-time comparisons, and equal hashing work for unknown login emails.
- Random session tokens in HttpOnly, SameSite=Strict cookies; only token hashes are stored in PostgreSQL. Sessions expire after seven days and are checked on every protected request.
- Password changes require the current password and revoke all prior sessions. The current browser receives a new session.
- Permanent account deletion requires the password and an explicit checkbox; it cascades through sessions and tracking records. Clearing tracking history separately keeps the account and profile.
- Database-backed attempt throttling, generic login failures, same-origin mutation checks, and server-side account ownership checks. Record updates include the expected account ID so an old tab cannot save another account's data after a login switch.

**Email verification, forgotten-password email recovery, and MFA are not implemented.** Email addresses identify accounts but ownership is not verified. There is no pretend reset link. Add a transactional email provider plus hashed, expiring, single-use tokens for verification and recovery before a public rollout. The global rate limit is a small-installation backstop; production also needs trusted proxy/IP controls and an appropriate abuse policy.

## Existing records

Migration `002_accounts.sql` preserves existing data and renames the old ownership column from `session_hash` to `owner_key`. At registration, users may explicitly choose to attach the old browser profile. This requires possession of its original `mhts-session` cookie, and a profile can be claimed only once. Unclaimed records remain in the database and are never exposed to unauthenticated requests. Without the old cookie, an administrator-assisted recovery is needed.

Older localStorage records can still be imported into an account with no assessments or check-ins. The old browser copy is removed only after successful persistence. Keep the same site origin to access those records. Test fixtures now live only under `tests/`.

## Database and application structure

- `users`: unique email, password hash, and owned profile key.
- `auth_sessions`: hashed tokens, user IDs, and expiration times.
- `auth_limits`: hashed throttle buckets, counters, and reset times.
- `profiles`, `checkins`, `assessments`, `activities`: owned tracking data and a revision counter.
- `schema_migrations`: transactional migration history.

Versioned questionnaire/check-in content uses JSONB in separate relational tables. Unique keys enforce one check-in per account per date. Saves replace that account's child records inside a transaction and recalculate assessment scores server-side. Revision checks reject stale writes. Requests are limited to 2 MB; individual-record endpoints would be more suitable at larger scale.

```text
src/app/api/auth/route.ts       # Registration, login, logout, password and deletion
src/app/api/data/route.ts       # Authenticated read/write/history clearing
src/app/api/assessments/        # Authenticated scoring
src/lib/auth.ts                # Sessions, origin checks, throttling
src/lib/passwords.ts           # Password hashing and verification
src/lib/database.ts            # PostgreSQL repository and transactions
src/components/auth-screen.tsx # Sign-in, registration, account security
src/components/app.tsx         # Main navigation, state, history, settings
src/components/forms.tsx       # Check-ins and assessments
src/components/dashboard.tsx   # Dashboard, charts, suggestions
database/migrations/           # Versioned SQL changes
tests/                         # Unit and browser/API tests
```

## Hosting later

Set a hosted PostgreSQL `DATABASE_URL`, run `npm run db:migrate`, and set `COOKIE_SECURE=true` for HTTPS. Set the canonical `APP_ORIGIN` when using a proxy. Local HTTP uses `COOKIE_SECURE=false`, including with `npm start`. Database credentials must never be `NEXT_PUBLIC_` variables. Use verified TLS, restricted application credentials, backups, and retention policies. Migrations create schema; transfer records separately with PostgreSQL backup/restore tools. Users can sign in again on the new domain.

## Validation

```bash
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Browser tests use port 3100 and isolated fictional accounts in the configured database; they do not reset your database. On this workspace use `PLAYWRIGHT_BROWSERS_PATH=/tmp/mhts-playwright npm run test:e2e`. Tests cover scoring, hashing, the full user journey, isolation, stale writes, password changes, session revocation/expiry, legacy claiming, and throttling. `npm run format` formats the source.

## Screening and AI

Questionnaire wording, scoring, source attribution, and screening limitations remain visible. Removing university branding does not turn screening into diagnosis. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for questionnaire licensing; the WHO-5 adaptation retains its non-commercial license conditions.

AI is not enabled. [docs/AI_PLAN.md](docs/AI_PLAN.md) describes a minimal approach to optional reflection prompts, grounded insights, and a small chatbot, with consent and safety boundaries. Generated questions must remain separate from validated assessment scoring.
