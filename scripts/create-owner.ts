import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createOwner } from "../lib/auth-owner";
import { validAuthConfig } from "../lib/auth";
import { openDatabase } from "../lib/db";

async function main() {
  if (!validAuthConfig({ secret: process.env.BETTER_AUTH_SECRET ?? "", baseURL: process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:3000" })) {
    throw new Error("Authentication configuration is missing or invalid.");
  }
  const email = process.env.DEID_OWNER_EMAIL;
  const password = process.env.DEID_OWNER_PASSWORD;
  const name = process.env.DEID_OWNER_NAME ?? "Owner";
  if (!email || !password) throw new Error("Owner credentials are missing.");
  const path = resolve(process.env.DATABASE_PATH ?? ".data/deid.sqlite");
  mkdirSync(dirname(path), { recursive: true });
  const database = openDatabase(path);
  try {
    await createOwner({ email, password, name }, database);
    console.log("Owner created. Public registration remains disabled.");
  } finally {
    database.close();
  }
}

main().catch(() => {
  // Do not echo input values, environment, or third-party error payloads.
  console.error("Owner creation failed. Check configuration and credentials; an existing owner cannot be overwritten.");
  process.exitCode = 1;
});
