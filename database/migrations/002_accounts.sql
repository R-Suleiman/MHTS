-- Preserve existing records; each old browser profile can be claimed once at registration.
ALTER TABLE profiles RENAME COLUMN session_hash TO owner_key;
ALTER TABLE checkins RENAME COLUMN session_hash TO owner_key;
ALTER TABLE assessments RENAME COLUMN session_hash TO owner_key;
ALTER TABLE activities RENAME COLUMN session_hash TO owner_key;

CREATE TABLE users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  profile_key text NOT NULL UNIQUE REFERENCES profiles(owner_key) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE auth_sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX auth_sessions_expiry ON auth_sessions(expires_at);
CREATE TABLE auth_limits (
  bucket text PRIMARY KEY,
  attempts integer NOT NULL,
  resets_at timestamptz NOT NULL
);
