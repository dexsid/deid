-- Experiment identity and per-locale editorial drafts/published snapshots.
-- Public reads must use only experiment_published and experiment_diary_published.
CREATE TABLE experiments (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  original_locale TEXT NOT NULL CHECK (original_locale IN ('ru', 'en', 'kk')),
  created_at INTEGER NOT NULL
);

CREATE TABLE experiment_drafts (
  experiment_id TEXT NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('ru', 'en', 'kk')),
  title TEXT NOT NULL,
  hypothesis TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('planned', 'running', 'paused', 'completed', 'cancelled')),
  outcome TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (experiment_id, locale)
);

CREATE TABLE experiment_published (
  experiment_id TEXT NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('ru', 'en', 'kk')),
  title TEXT NOT NULL,
  hypothesis TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('planned', 'running', 'paused', 'completed', 'cancelled')),
  outcome TEXT NOT NULL DEFAULT '',
  published_at INTEGER NOT NULL,
  PRIMARY KEY (experiment_id, locale)
);
CREATE INDEX experiment_published_date_idx
  ON experiment_published(published_at DESC, experiment_id);

-- Diary entries default to private. Only explicitly public entries are captured
-- in the immutable published snapshot when the experiment is published.
CREATE TABLE experiment_diary_drafts (
  id TEXT PRIMARY KEY NOT NULL,
  experiment_id TEXT NOT NULL,
  locale TEXT NOT NULL CHECK (locale IN ('ru', 'en', 'kk')),
  occurred_at INTEGER NOT NULL CHECK (occurred_at >= 0),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (experiment_id, locale)
    REFERENCES experiment_drafts(experiment_id, locale) ON DELETE CASCADE
);
CREATE INDEX experiment_diary_drafts_lookup_idx
  ON experiment_diary_drafts(experiment_id, locale, occurred_at, id);

CREATE TABLE experiment_diary_published (
  id TEXT PRIMARY KEY NOT NULL,
  experiment_id TEXT NOT NULL,
  locale TEXT NOT NULL CHECK (locale IN ('ru', 'en', 'kk')),
  occurred_at INTEGER NOT NULL CHECK (occurred_at >= 0),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  FOREIGN KEY (experiment_id, locale)
    REFERENCES experiment_published(experiment_id, locale) ON DELETE CASCADE
);
CREATE INDEX experiment_diary_published_lookup_idx
  ON experiment_diary_published(experiment_id, locale, occurred_at, id);
