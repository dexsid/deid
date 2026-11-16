import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase } from "../lib/db";
import { createExperimentStore } from "../lib/experiments";

const draft = {
  title: "Неделя без социальных сетей",
  hypothesis: "Если сократить экранное время, то сон улучшится",
  status: "running" as const,
  outcome: "",
};

const entry = {
  occurredAt: Date.UTC(2026, 10, 17),
  title: "День первый",
  body: "Заметил улучшение концентрации. Қазақша мәтін.",
};

describe("experiments: editorial drafts and public snapshots", () => {
  let dir: string;
  let database: ReturnType<typeof openDatabase>;
  let store: ReturnType<typeof createExperimentStore>;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "deid-experiments-test-"));
    database = openDatabase(join(dir, "experiments.sqlite"));
    store = createExperimentStore(database);
  });

  afterEach(() => {
    database?.close();
    rmSync(dir, { recursive: true, force: true });
  });

  function createDraft(slug = "digital-detox") {
    const experiment = store.create({ slug, originalLocale: "ru" });
    store.saveDraft(experiment.id, "ru", draft);
    return experiment;
  }

  it("installs only its new migration, with foreign keys and repeatable checksum checks", () => {
    expect(database.sqlite.prepare("SELECT count(*) AS count FROM _deid_migrations").get())
      .toEqual({ count: 4 });
    expect(database.sqlite.pragma("foreign_keys", { simple: true })).toBe(1);
    expect(() => createExperimentStore(database)).not.toThrow();
    expect(database.sqlite.prepare("SELECT count(*) AS count FROM _deid_migrations").get())
      .toEqual({ count: 4 });
    expect(() => database.sqlite.prepare(`INSERT INTO experiment_diary_published
      (id, experiment_id, locale, occurred_at, title, body)
      VALUES ('x', 'missing', 'ru', 0, 'a', 'b')`).run()).toThrow();
  });

  it("never exposes an unpublished experiment, draft hypothesis, or diary", () => {
    const experiment = createDraft();
    store.addDiaryEntry(experiment.id, "ru", { ...entry, visibility: "public" });
    expect(store.getDraft(experiment.id, "ru")?.hypothesis).toBe(draft.hypothesis);
    expect(store.listDraftDiary(experiment.id, "ru")).toHaveLength(1);
    expect(store.getPublished(experiment.slug, "ru")).toBeNull();
    expect(store.listPublished("ru", { q: "экранное" })).toEqual([]);
    expect(store.listPublished("ru", { q: "концентрации" })).toEqual([]);
  });

  it("publishes only diary entries explicitly marked public", () => {
    const experiment = createDraft();
    store.addDiaryEntry(experiment.id, "ru", { ...entry, body: "Мой личный секрет" });
    const openEntry = store.addDiaryEntry(experiment.id, "ru", {
      ...entry, occurredAt: entry.occurredAt + 1, visibility: "public",
    });
    const published = store.publish(experiment.id, "ru");
    expect(published.diary).toHaveLength(1);
    expect(published.diary[0].id).toBe(openEntry.id);
    expect(JSON.stringify(published)).not.toContain("Мой личный секрет");
    expect(store.listPublished("ru", { q: "личный секрет" })).toHaveLength(0);
    expect(store.listPublished("ru", { q: "концентрации" })).toHaveLength(1);
  });

  it("keeps a published snapshot immutable while drafts and diary are edited", () => {
    const experiment = createDraft();
    const observation = store.addDiaryEntry(experiment.id, "ru", { ...entry, visibility: "public" });
    const old = store.publish(experiment.id, "ru");
    store.saveDraft(experiment.id, "ru", {
      ...draft, title: "Скрытый заголовок", hypothesis: "Секретная гипотеза",
    });
    store.updateDiaryEntry(experiment.id, "ru", observation.id, {
      ...entry, body: "Частная редакция", visibility: "private",
    });
    store.addDiaryEntry(experiment.id, "ru", { ...entry, body: "Секрет дневника", visibility: "public" });
    expect(store.getPublished(experiment.slug, "ru")).toEqual(old);
    expect(store.listPublished("ru", { q: "Секретная" })).toEqual([]);
    expect(store.listPublished("ru", { q: "Частная" })).toEqual([]);
    expect(store.listPublished("ru", { q: "Секрет дневника" })).toEqual([]);
    const updated = store.publish(experiment.id, "ru");
    expect(updated.title).toBe("Скрытый заголовок");
    expect(updated.diary).toHaveLength(1);
    expect(updated.diary[0].body).toBe("Секрет дневника");
  });

  it("uses a published translation, or only the published original as fallback", () => {
    const experiment = createDraft();
    store.saveDraft(experiment.id, "en", {
      ...draft, title: "English draft only", hypothesis: "English-only private hypothesis",
    });
    store.publish(experiment.id, "ru");
    expect(store.getPublished(experiment.slug, "en")).toMatchObject({
      locale: "ru", originalLocale: "ru", isFallback: true, title: draft.title,
    });
    expect(store.listPublished("en", { q: "English-only" })).toEqual([]);
    store.publish(experiment.id, "en");
    expect(store.getPublished(experiment.slug, "en")).toMatchObject({
      locale: "en", isFallback: false, title: "English draft only",
    });
    expect(store.getPublished(experiment.slug, "kk")).toMatchObject({
      locale: "ru", isFallback: true,
    });
  });

  it("does not fall back to an unpublished original or unrelated language", () => {
    const experiment = createDraft("only-english");
    store.saveDraft(experiment.id, "en", { ...draft, title: "Only in English" });
    store.publish(experiment.id, "en");
    expect(store.getPublished(experiment.slug, "en")?.title).toBe("Only in English");
    expect(store.getPublished(experiment.slug, "ru")).toBeNull();
    expect(store.getPublished(experiment.slug, "kk")).toBeNull();
    expect(store.listPublished("kk")).toEqual([]);
  });

  it("validates completed outcomes and keeps the previous snapshot on failed publish", () => {
    const experiment = createDraft();
    const original = store.publish(experiment.id, "ru");
    store.saveDraft(experiment.id, "ru", {
      ...draft, status: "completed", title: "Completed without result", outcome: "  ",
    });
    expect(() => store.publish(experiment.id, "ru")).toThrow(/outcome/i);
    expect(store.getPublished(experiment.slug, "ru")).toEqual(original);
    store.saveDraft(experiment.id, "ru", {
      ...draft, status: "completed", outcome: "Сон стал лучше",
    });
    expect(store.publish(experiment.id, "ru")).toMatchObject({
      status: "completed", outcome: "Сон стал лучше",
    });
  });

  it("filters only published entries, supports Cyrillic search, status and pagination", () => {
    const first = createDraft("first-test");
    store.addDiaryEntry(first.id, "ru", { ...entry, visibility: "public" });
    store.publish(first.id, "ru");
    const second = createDraft("second-test");
    store.saveDraft(second.id, "ru", {
      ...draft, status: "paused", hypothesis: "Прогулка в лесу помогает",
    });
    store.publish(second.id, "ru");
    expect(store.listPublished("ru", { q: "ҚАЗАҚША" })).toHaveLength(1);
    expect(store.listPublished("ru", { status: "paused" }).map((item) => item.slug))
      .toEqual(["second-test"]);
    const all = store.listPublished("ru", { limit: 2 });
    expect(store.listPublished("ru", { limit: 1, offset: 1 })).toEqual([all[1]]);
  });

  it("unpublishes an experiment and diary but leaves editorial drafts intact", () => {
    const experiment = createDraft();
    store.addDiaryEntry(experiment.id, "ru", { ...entry, visibility: "public" });
    store.publish(experiment.id, "ru");
    expect(store.unpublish(experiment.id, "ru")).toBe(true);
    expect(store.unpublish(experiment.id, "ru")).toBe(false);
    expect(store.getPublished(experiment.slug, "ru")).toBeNull();
    expect(store.listPublished("ru")).toHaveLength(0);
    expect(store.getDraft(experiment.id, "ru")?.hypothesis).toBe(draft.hypothesis);
    expect(store.listDraftDiary(experiment.id, "ru")).toHaveLength(1);
    expect(database.sqlite.prepare("SELECT count(*) AS count FROM experiment_diary_published").get())
      .toEqual({ count: 0 });
  });

  it("rejects invalid input, cross-experiment diary edits, and unknown identifiers", () => {
    const experiment = createDraft();
    const other = createDraft("another-test");
    const note = store.addDiaryEntry(experiment.id, "ru", entry);
    expect(() => store.updateDiaryEntry(other.id, "ru", note.id, entry)).toThrow(/not found/i);
    expect(store.deleteDiaryEntry(other.id, "ru", note.id)).toBe(false);
    expect(store.getPublished("x' OR 1=1 --", "ru")).toBeNull();
    expect(() => store.create({ slug: "bad' slug", originalLocale: "ru" })).toThrow();
    expect(() => store.saveDraft(experiment.id, "ru", { ...draft, status: "invented" as never })).toThrow();
    expect(() => store.listPublished("ru", { limit: 101 })).toThrow();
    expect(() => store.addDiaryEntry(experiment.id, "ru", {
      ...entry, occurredAt: -1,
    })).toThrow();
  });
});
