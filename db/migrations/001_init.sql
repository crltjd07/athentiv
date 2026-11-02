-- ATHENTIV FocusDock — initial schema
-- All timestamps are INTEGER milliseconds since the Unix epoch (UTC).
-- Calendar days ("YYYY-MM-DD") are computed in the user's own time zone.

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------

CREATE TABLE avatars (
  key         TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  tier        TEXT NOT NULL CHECK (tier IN ('free', 'premium')),
  sort_order  INTEGER NOT NULL
);

INSERT INTO avatars (key, name, tier, sort_order) VALUES
  ('fox',    'Fox',    'free',    1),
  ('owl',    'Owl',    'free',    2),
  ('panda',  'Panda',  'free',    3),
  ('cat',    'Cat',    'free',    4),
  ('robot',  'Robot',  'premium', 5),
  ('rocket', 'Rocket', 'premium', 6),
  ('frog',   'Frog',   'premium', 7),
  ('star',   'Star',   'premium', 8);

CREATE TABLE subscription_plans (
  code            TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  period_unit     TEXT NOT NULL CHECK (period_unit IN ('day', 'month', 'year')),
  period_count    INTEGER NOT NULL CHECK (period_count > 0),
  price_centavos  INTEGER NOT NULL CHECK (price_centavos >= 0),
  currency        TEXT NOT NULL DEFAULT 'PHP',
  is_public       INTEGER NOT NULL DEFAULT 1 CHECK (is_public IN (0, 1)),
  sort_order      INTEGER NOT NULL
);

-- Proposed student pricing (see docs/SUBSCRIPTION.md). The trial plan is never sold.
INSERT INTO subscription_plans (code, name, period_unit, period_count, price_centavos, is_public, sort_order) VALUES
  ('weekly',  'Weekly Premium',  'day',   7,  2900, 1, 1),
  ('monthly', 'Monthly Premium', 'month', 1,  9900, 1, 2),
  ('annual',  'Annual Premium',  'year',  1, 79900, 1, 3),
  ('trial',   'Stand Owner Trial','day', 30,     0, 0, 9);

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------

CREATE TABLE users (
  id                    INTEGER PRIMARY KEY,
  username              TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash         TEXT NOT NULL,
  account_type          TEXT NOT NULL CHECK (account_type IN ('stand_owner', 'standard')),
  recovery_code_hash    TEXT,
  must_change_password  INTEGER NOT NULL DEFAULT 0 CHECK (must_change_password IN (0, 1)),
  -- Permanent marker: the 30-day stand trial is granted at most once per account.
  trial_granted_at      INTEGER,
  created_at            INTEGER NOT NULL,
  updated_at            INTEGER NOT NULL
);

CREATE TABLE user_profiles (
  user_id             INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name        TEXT NOT NULL,
  avatar_key          TEXT NOT NULL DEFAULT 'fox' REFERENCES avatars(key),
  school              TEXT,
  course              TEXT,
  year_level          TEXT,
  daily_goal_minutes  INTEGER NOT NULL DEFAULT 120 CHECK (daily_goal_minutes BETWEEN 10 AND 960),
  timezone            TEXT NOT NULL DEFAULT 'Asia/Manila',
  onboarded_at        INTEGER,
  updated_at          INTEGER NOT NULL
);

CREATE TABLE user_preferences (
  user_id               INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  deadline_reminders    INTEGER NOT NULL DEFAULT 1 CHECK (deadline_reminders IN (0, 1)),
  reminder_lead_hours   INTEGER NOT NULL DEFAULT 24 CHECK (reminder_lead_hours BETWEEN 1 AND 168),
  overdue_alerts        INTEGER NOT NULL DEFAULT 1 CHECK (overdue_alerts IN (0, 1)),
  session_sound         INTEGER NOT NULL DEFAULT 1 CHECK (session_sound IN (0, 1)),
  session_vibrate       INTEGER NOT NULL DEFAULT 1 CHECK (session_vibrate IN (0, 1)),
  daily_summary         INTEGER NOT NULL DEFAULT 1 CHECK (daily_summary IN (0, 1)),
  subscription_alerts   INTEGER NOT NULL DEFAULT 1 CHECK (subscription_alerts IN (0, 1)),
  weekly_goal_days      INTEGER NOT NULL DEFAULT 5 CHECK (weekly_goal_days BETWEEN 1 AND 7),
  updated_at            INTEGER NOT NULL
);

CREATE TABLE login_attempts (
  id          INTEGER PRIMARY KEY,
  username    TEXT NOT NULL COLLATE NOCASE,
  ip          TEXT NOT NULL,
  success     INTEGER NOT NULL CHECK (success IN (0, 1)),
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_login_attempts_user_time ON login_attempts (username, created_at);

-- ---------------------------------------------------------------------------
-- Devices and sessions
-- ---------------------------------------------------------------------------

CREATE TABLE devices (
  id               INTEGER PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_key_hash  TEXT NOT NULL,
  label            TEXT NOT NULL,
  first_seen_at    INTEGER NOT NULL,
  last_seen_at     INTEGER NOT NULL,
  UNIQUE (user_id, device_key_hash)
);

CREATE TABLE auth_sessions (
  id                  INTEGER PRIMARY KEY,
  user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id           INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  token_hash          TEXT NOT NULL UNIQUE,
  created_at          INTEGER NOT NULL,
  last_seen_at        INTEGER NOT NULL,
  expires_at          INTEGER NOT NULL,
  revoked_at          INTEGER,
  revoked_reason      TEXT CHECK (revoked_reason IN ('logout', 'replaced', 'password_changed', 'password_reset', 'expired')),
  -- NFC verification state for this session (stand owners only).
  nfc_stand_id        INTEGER REFERENCES phone_stands(id) ON DELETE SET NULL,
  nfc_verified_at     INTEGER,
  nfc_verified_until  INTEGER
);
CREATE INDEX idx_sessions_user_active ON auth_sessions (user_id, revoked_at);

-- ---------------------------------------------------------------------------
-- Phone stands and NFC
-- ---------------------------------------------------------------------------

CREATE TABLE phone_stands (
  id               INTEGER PRIMARY KEY,
  stand_code       TEXT NOT NULL UNIQUE,
  tag_secret_hash  TEXT NOT NULL,
  model            TEXT NOT NULL DEFAULT 'FocusDock Stand',
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at       INTEGER NOT NULL
);

CREATE TABLE stand_assignments (
  id             INTEGER PRIMARY KEY,
  stand_id       INTEGER NOT NULL REFERENCES phone_stands(id) ON DELETE CASCADE,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at    INTEGER NOT NULL,
  unassigned_at  INTEGER
);
-- A stand has at most one current owner, and an owner has at most one current stand.
CREATE UNIQUE INDEX uq_stand_current_owner ON stand_assignments (stand_id) WHERE unassigned_at IS NULL;
CREATE UNIQUE INDEX uq_user_current_stand ON stand_assignments (user_id) WHERE unassigned_at IS NULL;

CREATE TABLE nfc_verifications (
  id              INTEGER PRIMARY KEY,
  stand_id        INTEGER REFERENCES phone_stands(id) ON DELETE SET NULL,
  user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  session_id      INTEGER REFERENCES auth_sessions(id) ON DELETE SET NULL,
  result          TEXT NOT NULL CHECK (result IN ('verified', 'refreshed', 'invalid_tag', 'wrong_owner', 'stand_disabled', 'unassigned', 'login_required')),
  trial_granted   INTEGER NOT NULL DEFAULT 0 CHECK (trial_granted IN (0, 1)),
  checkin_status  TEXT CHECK (checkin_status IN ('pending', 'done', 'skipped')),
  ip              TEXT,
  created_at      INTEGER NOT NULL
);
CREATE INDEX idx_nfc_user_time ON nfc_verifications (user_id, created_at);

-- ---------------------------------------------------------------------------
-- Subscriptions
-- ---------------------------------------------------------------------------

CREATE TABLE subscription_transactions (
  id               INTEGER PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_code        TEXT NOT NULL REFERENCES subscription_plans(code),
  amount_centavos  INTEGER NOT NULL CHECK (amount_centavos >= 0),
  currency         TEXT NOT NULL DEFAULT 'PHP',
  provider         TEXT NOT NULL CHECK (provider IN ('sandbox')),
  provider_ref     TEXT NOT NULL UNIQUE,
  is_test          INTEGER NOT NULL DEFAULT 1 CHECK (is_test IN (0, 1)),
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'cancelled')),
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL,
  paid_at          INTEGER
);
CREATE INDEX idx_txn_user ON subscription_transactions (user_id, created_at);

-- Each row is one paid-for (or granted) Premium period. Periods are stacked end to end,
-- so buying while active extends the expiry date.
CREATE TABLE user_subscriptions (
  id              INTEGER PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_code       TEXT NOT NULL REFERENCES subscription_plans(code),
  source          TEXT NOT NULL CHECK (source IN ('trial', 'purchase', 'admin')),
  starts_at       INTEGER NOT NULL,
  ends_at         INTEGER NOT NULL,
  transaction_id  INTEGER UNIQUE REFERENCES subscription_transactions(id) ON DELETE SET NULL,
  created_at      INTEGER NOT NULL,
  CHECK (ends_at > starts_at)
);
CREATE INDEX idx_subs_user_end ON user_subscriptions (user_id, ends_at);
-- Database-level guarantee that a trial can never be granted twice.
CREATE UNIQUE INDEX uq_subs_one_trial ON user_subscriptions (user_id) WHERE source = 'trial';

-- ---------------------------------------------------------------------------
-- Academic data
-- ---------------------------------------------------------------------------

CREATE TABLE subjects (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL COLLATE NOCASE,
  color       TEXT NOT NULL,
  icon        TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  UNIQUE (user_id, name)
);

CREATE TABLE tasks (
  id            INTEGER PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id    INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('quiz', 'report', 'project', 'exam', 'assignment', 'other')),
  due_at        INTEGER NOT NULL,
  effort        TEXT NOT NULL CHECK (effort IN ('S', 'M', 'L')),
  description   TEXT,
  -- 'overdue' is derived (due_at < now and not completed) and never stored.
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  completed_at  INTEGER,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  CHECK ((status = 'completed') = (completed_at IS NOT NULL))
);
CREATE INDEX idx_tasks_user_status_due ON tasks (user_id, status, due_at);
CREATE INDEX idx_tasks_user_subject ON tasks (user_id, subject_id);
CREATE INDEX idx_tasks_user_completed ON tasks (user_id, completed_at);

CREATE TABLE task_checklist_items (
  id          INTEGER PRIMARY KEY,
  task_id     INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  done        INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
  sort_order  INTEGER NOT NULL,
  done_at     INTEGER,
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_checklist_task ON task_checklist_items (task_id, sort_order);

CREATE TABLE task_status_history (
  id           INTEGER PRIMARY KEY,
  task_id      INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  from_status  TEXT,
  to_status    TEXT NOT NULL,
  source       TEXT NOT NULL CHECK (source IN ('user', 'pomodoro', 'system')),
  changed_at   INTEGER NOT NULL
);
CREATE INDEX idx_task_history_task ON task_status_history (task_id, changed_at);

-- ---------------------------------------------------------------------------
-- Check-ins and focus
-- ---------------------------------------------------------------------------

CREATE TABLE mood_checkins (
  id                   INTEGER PRIMARY KEY,
  user_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nfc_verification_id  INTEGER REFERENCES nfc_verifications(id) ON DELETE SET NULL,
  mood                 TEXT NOT NULL CHECK (mood IN ('great', 'good', 'okay', 'tired', 'stressed', 'unmotivated')),
  mindset              TEXT NOT NULL CHECK (mindset IN ('ready', 'need_focus', 'distracted', 'pressured', 'starting')),
  intensity            INTEGER CHECK (intensity BETWEEN 1 AND 5),
  note                 TEXT,
  created_at           INTEGER NOT NULL
);
CREATE INDEX idx_checkins_user_time ON mood_checkins (user_id, created_at);

CREATE TABLE pomodoro_configurations (
  user_id              INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  preset               TEXT NOT NULL DEFAULT '25/5' CHECK (preset IN ('25/5', '50/10', 'custom')),
  custom_focus_minutes INTEGER NOT NULL DEFAULT 40 CHECK (custom_focus_minutes BETWEEN 1 AND 180),
  custom_break_minutes INTEGER NOT NULL DEFAULT 8 CHECK (custom_break_minutes BETWEEN 1 AND 60),
  auto_start_break     INTEGER NOT NULL DEFAULT 1 CHECK (auto_start_break IN (0, 1)),
  daily_goal_sessions  INTEGER NOT NULL DEFAULT 4 CHECK (daily_goal_sessions BETWEEN 1 AND 24),
  updated_at           INTEGER NOT NULL
);

CREATE TABLE pomodoro_sessions (
  id                 INTEGER PRIMARY KEY,
  user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id            INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  focus_session_id   INTEGER REFERENCES pomodoro_sessions(id) ON DELETE SET NULL,
  kind               TEXT NOT NULL CHECK (kind IN ('focus', 'break')),
  preset             TEXT NOT NULL CHECK (preset IN ('25/5', '50/10', 'custom')),
  planned_seconds    INTEGER NOT NULL CHECK (planned_seconds > 0),
  planned_break_seconds INTEGER,
  started_at         INTEGER NOT NULL,
  paused_at          INTEGER,
  paused_total_ms    INTEGER NOT NULL DEFAULT 0,
  ended_at           INTEGER,
  status             TEXT NOT NULL CHECK (status IN ('active', 'paused', 'completed', 'ended_early', 'cancelled', 'skipped')),
  end_reason         TEXT,
  focused_seconds    INTEGER,
  extensions         INTEGER NOT NULL DEFAULT 0,
  created_at         INTEGER NOT NULL
);
CREATE INDEX idx_pomo_user_start ON pomodoro_sessions (user_id, started_at);
CREATE INDEX idx_pomo_user_end ON pomodoro_sessions (user_id, kind, ended_at);
CREATE INDEX idx_pomo_task ON pomodoro_sessions (task_id);
-- At most one running (or paused) timer per user.
CREATE UNIQUE INDEX uq_pomo_one_live ON pomodoro_sessions (user_id) WHERE status IN ('active', 'paused');

CREATE TABLE study_audio_preferences (
  user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  sound_key   TEXT NOT NULL DEFAULT 'rain' CHECK (sound_key IN ('rain', 'ocean', 'forest', 'fireplace', 'fan', 'white', 'brown', 'pink')),
  volume      REAL NOT NULL DEFAULT 0.5 CHECK (volume BETWEEN 0 AND 1),
  updated_at  INTEGER NOT NULL
);

CREATE TABLE spotify_playlists (
  id           INTEGER PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  spotify_type TEXT NOT NULL CHECK (spotify_type IN ('playlist', 'album')),
  spotify_id   TEXT NOT NULL,
  label        TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  UNIQUE (user_id, spotify_type, spotify_id)
);

-- ---------------------------------------------------------------------------
-- Notifications, summaries, exports, achievements
-- ---------------------------------------------------------------------------

CREATE TABLE user_notifications (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  link        TEXT,
  dedupe_key  TEXT NOT NULL,
  read_at     INTEGER,
  created_at  INTEGER NOT NULL,
  UNIQUE (user_id, dedupe_key)
);
CREATE INDEX idx_notifications_user_time ON user_notifications (user_id, created_at);

CREATE TABLE daily_productivity_summaries (
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day              TEXT NOT NULL,
  focus_minutes    INTEGER NOT NULL DEFAULT 0,
  focus_sessions   INTEGER NOT NULL DEFAULT 0,
  tasks_completed  INTEGER NOT NULL DEFAULT 0,
  tasks_created    INTEGER NOT NULL DEFAULT 0,
  checkins         INTEGER NOT NULL DEFAULT 0,
  updated_at       INTEGER NOT NULL,
  PRIMARY KEY (user_id, day)
);

CREATE TABLE export_requests (
  id           INTEGER PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('tasks', 'pomodoro', 'stats', 'mood', 'full')),
  format       TEXT NOT NULL CHECK (format IN ('csv', 'pdf', 'json')),
  range_start  INTEGER NOT NULL,
  range_end    INTEGER NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('completed', 'denied', 'failed')),
  row_count    INTEGER,
  created_at   INTEGER NOT NULL
);
CREATE INDEX idx_exports_user ON export_requests (user_id, created_at);

CREATE TABLE user_achievements (
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key          TEXT NOT NULL,
  unlocked_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, key)
);
