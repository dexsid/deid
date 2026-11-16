import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import { openDatabase } from "./db";
import { locales, type Locale } from "./i18n";

const localeSchema = z.enum(locales);
const idSchema = z.string().uuid();
const slugSchema = z.string().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export function normalizeSearch(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();
}

export const articleDraftSchema = z.object({
  title: z.string().trim().min(1).max(240),
  summary: z.string().trim().max(4000),
  body: z.string().max(200_000),
  tags: z.array(z.string().trim().min(1).max(60)).max(20).transform((tags) => {
    const seen = new Set<string>();
    return tags.filter((tag) => {
      const key = normalizeSearch(tag);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }),
}).strict();

export type ArticleDraft = z.input<typeof articleDraftSchema>;
export type ArticleIdentity = { id: string; slug: string; originalLocale: Locale };
export type PublishedArticle = ArticleIdentity & ArticleDraft & {
  locale: Locale;
  isFallback: boolean;
  publishedAt: number;
};

type PublishedRow = ArticleIdentity & {
  locale: Locale;
  title: string;
  summary: string;
  body: string;
  tags: string;
  publishedAt: number;
};

const publicSelection = `SELECT a.id, a.slug, a.original_locale AS originalLocale,
  p.locale, p.title, p.summary, p.body, p.tags, p.published_at AS publishedAt
  FROM articles a JOIN article_published p ON p.article_id = a.id`;

function fromRow(row: PublishedRow, requestedLocale: Locale): PublishedArticle {
  return { ...row, tags: z.array(z.string()).parse(JSON.parse(row.tags)), isFallback: row.locale !== requestedLocale };
}

function newestFirst(a: PublishedArticle, b: PublishedArticle) {
  return b.publishedAt - a.publishedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Server-only persistence primitives; callers must authorize every mutation. */
export function createArticleStore(database: ReturnType<typeof openDatabase>) {
  const sqlite = database.sqlite;

  function create(input: { slug: string; originalLocale: Locale }): ArticleIdentity {
    const { slug, originalLocale } = z.object({ slug: slugSchema, originalLocale: localeSchema }).strict().parse(input);
    const id = randomUUID();
    sqlite.prepare("INSERT INTO articles (id, slug, original_locale, created_at) VALUES (?, ?, ?, ?)")
      .run(id, slug, originalLocale, Date.now());
    return { id, slug, originalLocale };
  }

  function saveDraft(articleId: string, locale: Locale, input: ArticleDraft): ArticleDraft {
    idSchema.parse(articleId);
    localeSchema.parse(locale);
    const draft = articleDraftSchema.parse(input);
    sqlite.prepare(`INSERT INTO article_drafts (article_id, locale, title, summary, body, tags, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(article_id, locale) DO UPDATE SET
      title = excluded.title, summary = excluded.summary, body = excluded.body,
      tags = excluded.tags, updated_at = excluded.updated_at`)
      .run(articleId, locale, draft.title, draft.summary, draft.body, JSON.stringify(draft.tags), Date.now());
    return draft;
  }

  function getDraft(articleId: string, locale: Locale): ArticleDraft | null {
    idSchema.parse(articleId);
    localeSchema.parse(locale);
    const row = sqlite.prepare("SELECT title, summary, body, tags FROM article_drafts WHERE article_id = ? AND locale = ?")
      .get(articleId, locale) as { title: string; summary: string; body: string; tags: string } | undefined;
    return row ? articleDraftSchema.parse({ ...row, tags: JSON.parse(row.tags) }) : null;
  }

  function publish(articleId: string, locale: Locale): PublishedArticle {
    idSchema.parse(articleId);
    localeSchema.parse(locale);
    return sqlite.transaction(() => {
      const draft = getDraft(articleId, locale);
      if (!draft) throw new Error("No draft exists for this article and language.");
      if (!draft.body.trim()) throw new Error("The article body is required for publication.");
      const publishedAt = Date.now();
      sqlite.prepare(`INSERT INTO article_published (article_id, locale, title, summary, body, tags, published_at)
        VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(article_id, locale) DO UPDATE SET
        title = excluded.title, summary = excluded.summary, body = excluded.body,
        tags = excluded.tags, published_at = excluded.published_at`)
        .run(articleId, locale, draft.title, draft.summary, draft.body, JSON.stringify(draft.tags), publishedAt);
      const row = sqlite.prepare(`${publicSelection} WHERE a.id = ? AND p.locale = ?`).get(articleId, locale) as PublishedRow;
      return fromRow(row, locale);
    }).immediate();
  }

  function getPublished(slug: string, locale: Locale): PublishedArticle | null {
    if (!slugSchema.safeParse(slug).success) return null;
    localeSchema.parse(locale);
    const row = sqlite.prepare(`${publicSelection} WHERE a.slug = ? AND (p.locale = ? OR p.locale = a.original_locale)
      ORDER BY CASE WHEN p.locale = ? THEN 0 ELSE 1 END LIMIT 1`).get(slug, locale, locale) as PublishedRow | undefined;
    return row ? fromRow(row, locale) : null;
  }

  function publishedForLocale(locale: Locale): PublishedArticle[] {
    localeSchema.parse(locale);
    const rows = sqlite.prepare(`${publicSelection} WHERE p.locale = ? OR p.locale = a.original_locale`).all(locale) as PublishedRow[];
    const selected = new Map<string, PublishedArticle>();
    for (const row of rows) {
      if (!selected.has(row.id) || row.locale === locale) selected.set(row.id, fromRow(row, locale));
    }
    return [...selected.values()].sort(newestFirst);
  }

  function listPublished(locale: Locale, options: { q?: string; tag?: string; limit?: number; offset?: number } = {}): PublishedArticle[] {
    const filter = z.object({ q: z.string().max(200).optional(), tag: z.string().max(60).optional(), limit: z.number().int().min(1).max(100).default(50), offset: z.number().int().min(0).max(1_000_000).default(0) }).parse(options);
    const terms = normalizeSearch(filter.q ?? "").split(" ").filter(Boolean);
    const tag = normalizeSearch(filter.tag ?? "");
    return publishedForLocale(locale).filter((article) => {
      if (tag && !article.tags.some((value) => normalizeSearch(value) === tag)) return false;
      const searchable = normalizeSearch([article.title, article.summary, article.body, ...article.tags].join(" "));
      return terms.every((term) => searchable.includes(term));
    }).slice(filter.offset, filter.offset + filter.limit);
  }

  function recommendations(slug: string, locale: Locale, limit = 3): PublishedArticle[] {
    z.number().int().min(1).max(20).parse(limit);
    const current = getPublished(slug, locale);
    if (!current) return [];
    const tags = new Set(current.tags.map(normalizeSearch));
    return publishedForLocale(locale)
      .filter((article) => article.id !== current.id)
      .map((article) => ({ article, shared: article.tags.filter((tag) => tags.has(normalizeSearch(tag))).length }))
      .filter(({ shared }) => shared > 0)
      .sort((a, b) => b.shared - a.shared || newestFirst(a.article, b.article))
      .slice(0, limit).map(({ article }) => article);
  }

  return { create, saveDraft, getDraft, publish, getPublished, listPublished, recommendations };
}

let store: ReturnType<typeof createArticleStore> | undefined;

export function getArticleStore() {
  if (!store) {
    const path = resolve(process.env.DATABASE_PATH ?? ".data/deid.sqlite");
    mkdirSync(dirname(path), { recursive: true });
    store = createArticleStore(openDatabase(path));
  }
  return store;
}
