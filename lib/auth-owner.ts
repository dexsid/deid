import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import type { openDatabase } from "./db";
import { OWNER_ID } from "./auth";

const ownerInput = z.object({
  email: z.email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(12).max(128),
  name: z.string().trim().min(1).max(100),
});

/** Local bootstrap only: refuses to replace an existing account or credentials. */
export async function createOwner(input: { email: string; password: string; name: string }, database: ReturnType<typeof openDatabase>) {
  const result = ownerInput.safeParse(input);
  if (!result.success) throw new Error("Owner details are invalid. Supply a valid email, name, and 12–128 character password.");
  const { email, password, name } = result.data;
  const passwordHash = await hashPassword(password);
  const now = Date.now();
  database.sqlite.transaction(() => {
    if (database.sqlite.prepare("SELECT id FROM auth_user LIMIT 1").get()) {
      throw new Error("An owner already exists. Existing credentials were not changed.");
    }
    database.sqlite.prepare("INSERT INTO auth_user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)")
      .run(OWNER_ID, name, email, now, now);
    database.sqlite.prepare("INSERT INTO auth_account (id, account_id, provider_id, user_id, password, created_at, updated_at) VALUES (?, ?, 'credential', ?, ?, ?, ?)")
      .run(randomUUID(), OWNER_ID, OWNER_ID, passwordHash, now, now);
  }).immediate();
  return { id: OWNER_ID };
}
