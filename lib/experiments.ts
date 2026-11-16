import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import { migrateDatabase, openDatabase } from "./db";
import { locales, type Locale } from "./i18n";

const localeSchema = z.enum(locales);
const idSchema = z.string().uuid();
const slugSchema = z.string().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const timestampSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

export const experimentStatuses = ["planned", "running", "paused", "completed", "cancelled"] as const;
export const experimentStatusSchema = z.enum(experimentStatuses);
export type ExperimentStatus = z.infer<typeof experimentStatusSchema>;

export const experimentDraftSchema = z.object({
  title: z.string().trim().min(1).max(240),
  hypothesis: z.string().trim().min(1).max(10_000),
  status: experimentStatusSchema,
  outcome: z.string().trim().max(100_000),
}).strict();

export const experimentDiarySchema = z.object({
  occurredAt: timestampSchema,
  title: z.string().trim().max(240),
  body: z.string().trim().min(1).max(30_000),
  visibility: z.enum(["private", "public"]).default("private"),
}).strict();

export type ExperimentDraft = z.input<typeof experimentDraftSchema>;
export type ExperimentDiaryInput = z.input<typeof experimentDiarySchema>;
export type ExperimentIdentity = { id: string; slug: string; originalLocale: Locale };
export type ExperimentDiaryEntry = {
  id: string;
  occurredAt: number;
  title: string;
  body: string;
};
export type ExperimentDiaryDraft = ExperimentDiaryEntry & {
  visibility: "private" | "public";
  updatedAt: number;
};
export type PublishedExperiment = ExperimentIdentity & z.infer<typeof experimentDraftSchema> & {
  locale: Locale;
  isFallback: boolean;
  publishedAt: number;
  diary: ExperimentDiaryEntry[];
};

type PublishedRow = ExperimentIdentity & z.infer<typeof experimentDraftSchema> & {
  locale: Locale;
  publishedAt: number;
};

type DiaryRow = ExperimentDiaryEntry;

const publicSelection = `SELECT e.id, e.slug, e.original_locale AS originalLocale,
  p.locale, p.title, p.hypothesis, p.status, p.outcome, p.published_at AS publishedAt
  FROM experiments e JOIN experiment_published p ON p.experiment_id = e.id`;

function normalizeSearch(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();
}

function newestFirst(a: PublishedExperiment, b: PublishedExperiment): number {
  return b.publishedAt - a.publishedAt || a.id.localeCompare(b.id);
}

/**
 * This module owns its migration because lib/db.ts currently enumerates
 * migrations 0001–0003 and is outside this task's permitted edit scope.
 * migrateDatabase is checksum-aware and safe to repeat on an open connection.
 */
function ensureExperimentMigration(database: ReturnType<typeof openDatabase>): void {
  migrateDatabase(database.sqlite, [{
    id: "0004_experiments",
    sql: readFileSync(resolve(process.cwd(), "migrations/0004_experiments.sql"), "utf8"),
  }]);
}

/** Server-only persistence primitives. Calling routes must authorize all mutations. */
export function createExperimentStore(database: ReturnType<typeof openDatabase>) {
  const sqlite = database.sqlite;
  ensureExperimentMigration(database);

  const getPublishedDiary = sqlite.prepare(`SELECT id, occurred_at AS occurredAt, title, body
    FROM experiment_diary_published WHERE experiment_id = ? AND locale = ?
    ORDER BY occurred_at ASC, id ASC`);
  const getDraftDiary = sqlite.prepare(`SELECT id, occurred_at AS occurredAt, title, body,
    visibility, updated_at AS updatedAt FROM experiment_diary_drafts
    WHERE experiment_id = ? AND locale = ? ORDER BY occurred_at ASC, id ASC`);

  function fromRow(row: PublishedRow, requestedLocale: Locale): PublishedExperiment {
    return {
      ...row,
      isFallback: row.locale !== requestedLocale,
      diary: getPublishedDiary.all(row.id, row.locale) as DiaryRow[],
    };
  }

  function create(input: { slug: string; originalLocale: Locale }): ExperimentIdentity {
    const { slug, originalLocale } = z.object({
      slug: slugSchema, originalLocale: localeSchema,
    }).strict().parse(input);
    const id = randomUUID();
    sqlite.prepare("INSERT INTO experiments (id, slug, original_locale, created_at) VALUES (?, ?, ?, ?)")
      .run(id, slug, originalLocale, Date.now());
    return { id, slug, originalLocale };
  }

  function saveDraft(experimentId: string, locale: Locale, input: ExperimentDraft): z.infer<typeof experimentDraftSchema> {
    idSchema.parse(experimentId);
    localeSchema.parse(locale);
    const draft = experimentDraftSchema.parse(input);
    sqlite.prepare(`INSERT INTO experiment_drafts
      (experiment_id, locale, title, hypothesis, status, outcome, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(experiment_id, locale) DO UPDATE SET
        title = excluded.title, hypothesis = excluded.hypothesis,
        status = excluded.status, outcome = excluded.outcome,
        updated_at = excluded.updated_at`)
      .run(experimentId, locale, draft.title, draft.hypothesis, draft.status, draft.outcome, Date.now());
    return draft;
  }

  function getDraft(experimentId: string, locale: Locale): z.infer<typeof experimentDraftSchema> | null {
    idSchema.parse(experimentId);
    localeSchema.parse(locale);
    const row = sqlite.prepare(`SELECT title, hypothesis, status, outcome
      FROM experiment_drafts WHERE experiment_id = ? AND locale = ?`)
      .get(experimentId, locale) as z.infer<typeof experimentDraftSchema> | undefined;
    return row ? experimentDraftSchema.parse(row) : null;
  }

  function listDraftDiary(experimentId: string, locale: Locale): ExperimentDiaryDraft[] {
    idSchema.parse(experimentId);
    localeSchema.parse(locale);
    return getDraftDiary.all(experimentId, locale) as ExperimentDiaryDraft[];
  }

  /** Entries are private by default; marking them public stages them for the next publish. */
  function addDiaryEntry(experimentId: string, locale: Locale, input: ExperimentDiaryInput): ExperimentDiaryDraft {
    idSchema.parse(experimentId);
    localeSchema.parse(locale);
    const data = experimentDiarySchema.parse(input);
    const id = randomUUID();
    const updatedAt = Date.now();
    sqlite.prepare(`INSERT INTO experiment_diary_drafts
      (id, experiment_id, locale, occurred_at, title, body, visibility, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, experimentId, locale, data.occurredAt, data.title, data.body, data.visibility, updatedAt);
    return { id, ...data, updatedAt };
  }

  function updateDiaryEntry(experimentId: string, locale: Locale, entryId: string, input: ExperimentDiaryInput): ExperimentDiaryDraft {
    idSchema.parse(experimentId);
    localeSchema.parse(locale);
    idSchema.parse(entryId);
    const data = experimentDiarySchema.parse(input);
    const updatedAt = Date.now();
    const result = sqlite.prepare(`UPDATE experiment_diary_drafts SET
      occurred_at = ?, title = ?, body = ?, visibility = ?, updated_at = ?
      WHERE id = ? AND experiment_id = ? AND locale = ?`)
      .run(data.occurredAt, data.title, data.body, data.visibility, updatedAt, entryId, experimentId, locale);
    if (result.changes !== 1) throw new Error("Diary entry not found.");
    return { id: entryId, ...data, updatedAt };
  }

  function deleteDiaryEntry(experimentId: string, locale: Locale, entryId: string): boolean {
    idSchema.parse(experimentId);
    localeSchema.parse(locale);
    idSchema.parse(entryId);
    return sqlite.prepare(`DELETE FROM experiment_diary_drafts
      WHERE id = ? AND experiment_id = ? AND locale = ?`)
      .run(entryId, experimentId, locale).changes === 1;
  }

  /** Publish atomically: copy the editorial draft and only opted-in public diary entries. */
  function publish(experimentId: string, locale: Locale): PublishedExperiment {
    idSchema.parse(experimentId);
    localeSchema.parse(locale);
    return sqlite.transaction(() => {
      const draft = getDraft(experimentId, locale);
      if (!draft) throw new Error("No draft exists for this experiment and language.");
      if (draft.status === "completed" && !draft.outcome) {
        throw new Error("A completed experiment needs an outcome before publication.");
      }
      const publishedAt = Date.now();
      sqlite.prepare(`INSERT INTO experiment_published
        (experiment_id, locale, title, hypothesis, status, outcome, published_at)
        VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(experiment_id, locale) DO UPDATE SET
          title = excluded.title, hypothesis = excluded.hypothesis,
          status = excluded.status, outcome = excluded.outcome,
          published_at = excluded.published_at`)
        .run(experimentId, locale, draft.title, draft.hypothesis, draft.status, draft.outcome, publishedAt);
      sqlite.prepare(`DELETE FROM experiment_diary_published
        WHERE experiment_id = ? AND locale = ?`).run(experimentId, locale);
      sqlite.prepare(`INSERT INTO experiment_diary_published
        (id, experiment_id, locale, occurred_at, title, body)
        SELECT id, experiment_id, locale, occurred_at, title, body
        FROM experiment_diary_drafts WHERE experiment_id = ? AND locale = ? AND visibility = 'public'`)
        .run(experimentId, locale);
      const row = sqlite.prepare(`${publicSelection} WHERE e.id = ? AND p.locale = ?`)
        .get(experimentId, locale) as PublishedRow;
      return fromRow(row, locale);
    }).immediate();
  }

  /** Unpublish cascades to the published diary snapshot, preserving all drafts. */
  function unpublish(experimentId: string, locale: Locale): boolean {
    idSchema.parse(experimentId);
    localeSchema.parse(locale);
    return sqlite.prepare(`DELETE FROM experiment_published WHERE experiment_id = ? AND locale = ?`)
      .run(experimentId, locale).changes === 1;
  }

  function getPublished(slug: string, locale: Locale): PublishedExperiment | null {
    if (!slugSchema.safeParse(slug).success) return null;
    localeSchema.parse(locale);
    const row = sqlite.prepare(`${publicSelection}
      WHERE e.slug = ? AND (p.locale = ? OR p.locale = e.original_locale)
      ORDER BY CASE WHEN p.locale = ? THEN 0 ELSE 1 END LIMIT 1`)
      .get(slug, locale, locale) as PublishedRow | undefined;
    return row ? fromRow(row, locale) : null;
  }

  function publishedForLocale(locale: Locale): PublishedExperiment[] {
    localeSchema.parse(locale);
    const rows = sqlite.prepare(`${publicSelection}
      WHERE p.locale = ? OR p.locale = e.original_locale`).all(locale) as PublishedRow[];
    const selected = new Map<string, PublishedExperiment>();
    for (const row of rows) {
      // Do not query drafts to perform fallback, search, or sorting.
      if (!selected.has(row.id) || row.locale === locale) selected.set(row.id, fromRow(row, locale));
    }
    return [...selected.values()].sort(newestFirst);
  }

  function listPublished(locale: Locale, options: {
    q?: string; status?: ExperimentStatus; limit?: number; offset?: number;
  } = {}): PublishedExperiment[] {
    const filter = z.object({
      q: z.string().max(200).optional(),
      status: experimentStatusSchema.optional(),
      limit: z.number().int().min(1).max(100).default(50),
      offset: z.number().int().min(0).max(1_000_000).default(0),
    }).strict().parse(options);
    const terms = normalizeSearch(filter.q ?? "").split(" ").filter(Boolean);
    return publishedForLocale(locale).filter((experiment) => {
      if (filter.status && filter.status !== experiment.status) return false;
      const searchable = normalizeSearch([
        experiment.title, experiment.hypothesis, experiment.outcome,
        ...experiment.diary.flatMap((entry) => [entry.title, entry.body]),
      ].join(" "));
      return terms.every((term) => searchable.includes(term));
    }).slice(filter.offset, filter.offset + filter.limit);
  }

  return {
    create, saveDraft, getDraft, listDraftDiary,
    addDiaryEntry, updateDiaryEntry, deleteDiaryEntry,
    publish, unpublish, getPublished, listPublished,
  };
}

let store: ReturnType<typeof createExperimentStore> | undefined;

/** Lazy production store, with the same DATABASE_PATH convention as articles. */
export function getExperimentStore() {
  if (!store) {
    const path = resolve(process.env.DATABASE_PATH ?? ".data/deid.sqlite");
    mkdirSync(dirname(path), { recursive: true });
    const database = openDatabase(path);
    try {
      store = createExperimentStore(database);
    } catch (error) {
      database.close();
      throw error;
    }
  }
  return store;
}
