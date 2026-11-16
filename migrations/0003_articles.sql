CREATE TABLE articles (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  original_locale TEXT NOT NULL CHECK (original_locale IN ('ru', 'en', 'kk')),
  created_at INTEGER NOT NULL
);
CREATE TABLE article_drafts (
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('ru', 'en', 'kk')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  body TEXT NOT NULL,
  tags TEXT NOT NULL CHECK (json_valid(tags) AND json_type(tags) = 'array'),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (article_id, locale)
);
CREATE TABLE article_published (
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('ru', 'en', 'kk')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  body TEXT NOT NULL,
  tags TEXT NOT NULL CHECK (json_valid(tags) AND json_type(tags) = 'array'),
  published_at INTEGER NOT NULL,
  PRIMARY KEY (article_id, locale)
);
CREATE INDEX article_published_date_idx ON article_published(published_at DESC, article_id);
