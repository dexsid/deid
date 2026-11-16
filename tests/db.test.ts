import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { migrateDatabase, openDatabase } from "../lib/db";

describe("SQLite persistence and migrations", () => {
  let directory: string;
  let database: ReturnType<typeof openDatabase> | undefined;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "deid-db-test-"));
  });

  afterEach(() => {
    database?.close();
    database = undefined;
    // Only the fresh temporary directory created by this test is removed.
    rmSync(directory, { recursive: true, force: true });
  });

  it("migrates a separate file, enables foreign keys, and exposes Drizzle", () => {
    database = openDatabase(join(directory, "test.sqlite"));
    expect(database.sqlite.pragma("foreign_keys", { simple: true })).toBe(1);
    expect(database.db.get(sql`SELECT count(*) AS count FROM _deid_migrations`)).toEqual({ count: 3 });
    expect(() => database!.sqlite.prepare("INSERT INTO site_settings VALUES (?, ?)").run("invalid", "not-json")).toThrow();
  });

  it("preserves data across repeated migrations and reopening", () => {
    const path = join(directory, "test.sqlite");
    database = openDatabase(path);
    database.sqlite.prepare("INSERT INTO site_settings VALUES (?, ?)").run("title", JSON.stringify("Deid — білім"));
    migrateDatabase(database.sqlite);
    database.close();
    database = undefined;
    database = openDatabase(path);
    expect(database.sqlite.prepare("SELECT value FROM site_settings WHERE key = ?").get("title"))
      .toEqual({ value: JSON.stringify("Deid — білім") });
    expect(database.sqlite.prepare("SELECT count(*) AS count FROM _deid_migrations").get()).toEqual({ count: 3 });
  });

  it("upgrades the prior authentication schema without changing existing settings or owner data", () => {
    const path = join(directory, 'upgrade.sqlite');
    const previous = new Database(path);
    try {
      migrateDatabase(previous, ['0001_bootstrap', '0002_auth'].map(id => ({ id, sql: readFileSync(join(process.cwd(), 'migrations', `${id}.sql`), 'utf8') })));
      previous.prepare('INSERT INTO site_settings VALUES (?, ?)').run('title', JSON.stringify('Original settings'));
      previous.prepare('INSERT INTO auth_user (id, name, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run('deid-owner', 'Test owner', 'owner@example.test', 1, 1);
    } finally {
      previous.close();
    }
    database = openDatabase(path);
    expect(database.sqlite.prepare('SELECT name, email FROM auth_user').get()).toEqual({ name: 'Test owner', email: 'owner@example.test' });
    expect(database.sqlite.prepare("SELECT value FROM site_settings WHERE key = 'title'").get()).toEqual({ value: JSON.stringify('Original settings') });
    expect(database.sqlite.prepare('SELECT count(*) AS count FROM _deid_migrations').get()).toEqual({ count: 3 });
  });

  it("rolls back every pending migration and preserves pre-existing data on failure", () => {
    database = openDatabase(join(directory, "test.sqlite"));
    database.sqlite.prepare("INSERT INTO site_settings VALUES (?, ?)").run("title", '"Original"');
    expect(() => migrateDatabase(database!.sqlite, [
      { id: "0002_test", sql: "CREATE TABLE test_records (id INTEGER); INSERT INTO test_records VALUES (1);" },
      { id: "0003_test", sql: "UPDATE site_settings SET value = '\"Changed\"'; INSERT INTO missing_table VALUES (1);" },
    ])).toThrow();
    expect(database.sqlite.prepare("SELECT value FROM site_settings WHERE key = 'title'").get()).toEqual({ value: '"Original"' });
    expect(database.sqlite.prepare("SELECT name FROM sqlite_master WHERE name = 'test_records'").get()).toBeUndefined();
    expect(database.sqlite.prepare("SELECT count(*) AS count FROM _deid_migrations").get()).toEqual({ count: 3 });
  });

  it("rejects changes to an already applied migration", () => {
    database = openDatabase(join(directory, "test.sqlite"));
    expect(() => migrateDatabase(database!.sqlite, [
      { id: "0001_bootstrap", sql: "DROP TABLE site_settings;" },
    ])).toThrow("Applied migration has changed");
    expect(database.sqlite.prepare("SELECT count(*) AS count FROM site_settings").get()).toEqual({ count: 0 });
  });
});
