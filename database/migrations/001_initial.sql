CREATE TABLE profiles (
  session_hash text PRIMARY KEY,
  revision integer NOT NULL DEFAULT 0,
  profile jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE checkins (
  session_hash text NOT NULL REFERENCES profiles ON DELETE CASCADE,
  day date NOT NULL,
  record jsonb NOT NULL,
  PRIMARY KEY (session_hash, day)
);
CREATE TABLE assessments (
  session_hash text NOT NULL REFERENCES profiles ON DELETE CASCADE,
  id text NOT NULL,
  record jsonb NOT NULL,
  scores jsonb NOT NULL,
  PRIMARY KEY (session_hash, id)
);
CREATE TABLE activities (
  session_hash text NOT NULL REFERENCES profiles ON DELETE CASCADE,
  id text NOT NULL,
  completed boolean NOT NULL,
  PRIMARY KEY (session_hash, id)
);
