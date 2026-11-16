import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

export interface Migration {
  id: string;
  sql: string;
}

function defaultMigrations(): Migration[] {
  return [
    {
      id: "0001_bootstrap",
      sql: readFileSync(resolve(process.cwd(), "migrations/0001_bootstrap.sql"), "utf8"),
    },
    {
      id: "0002_auth",
      sql: readFileSync(resolve(process.cwd(), "migrations/0002_auth.sql"), "utf8"),
    },
    {
      id: "0003_articles",
      sql: readFileSync(resolve(process.cwd(), "migrations/0003_articles.sql"), "utf8"),
    },
  ];
}

/** Apply pending migrations atomically; never silently rewrite migration history. */
export function migrateDatabase(
  sqlite: Database.Database,
  migrations: readonly Migration[] = defaultMigrations(),
): void {
  const ids = migrations.map((migration) => migration.id);
  if (new Set(ids).size !== ids.length || ids.some((id) => !id.trim())) {
    throw new Error("Migration IDs must be unique and non-empty.");
  }

  sqlite.transaction(() => {
    sqlite.exec(`CREATE TABLE IF NOT EXISTS _deid_migrations (
      id TEXT PRIMARY KEY NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    const getMigration = sqlite.prepare("SELECT checksum FROM _deid_migrations WHERE id = ?");
    const recordMigration = sqlite.prepare("INSERT INTO _deid_migrations (id, checksum) VALUES (?, ?)");

    for (const migration of migrations) {
      // Line endings differ across Windows checkouts without changing the migration.
      const checksum = createHash("sha256").update(migration.sql.replace(/\r\n/g, "\n")).digest("hex");
      const applied = getMigration.get(migration.id) as { checksum: string } | undefined;
      if (applied) {
        if (applied.checksum !== checksum) {
          throw new Error(`Applied migration has changed: ${migration.id}`);
        }
        continue;
      }
      sqlite.exec(migration.sql);
      recordMigration.run(migration.id, checksum);
    }
  }).immediate();
}

/** The caller owns the connection and must close it when its work is complete. */
export function openDatabase(path: string) {
  const sqlite = new Database(path);
  try {
    sqlite.pragma("foreign_keys = ON");
    sqlite.pragma("busy_timeout = 5000");
    sqlite.pragma("journal_mode = WAL");
    migrateDatabase(sqlite);
    return {
      sqlite,
      db: drizzle(sqlite),
      close: () => sqlite.close(),
    };
  } catch (error) {
    sqlite.close();
    throw error;
  }
}
