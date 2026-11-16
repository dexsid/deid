import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { openDatabase } from "./db";
import { authSchema } from "./schema";

export const OWNER_ID = "deid-owner";

export type AuthConfig = { secret: string; baseURL: string };

export class AuthAccessError extends Error {
  constructor(public readonly status: 401 | 503) {
    super(status === 503 ? "Authentication is not configured." : "Owner authentication is required.");
    this.name = "AuthAccessError";
  }
}

export function validAuthConfig(config: AuthConfig): boolean {
  if (config.secret.trim().length < 32) return false;
  try {
    const url = new URL(config.baseURL);
    return ["http:", "https:"].includes(url.protocol)
      && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
      && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash;
  } catch {
    return false;
  }
}

export function createAuth(database: ReturnType<typeof openDatabase>, config: AuthConfig) {
  if (!validAuthConfig(config)) throw new AuthAccessError(503);
  return betterAuth({
    appName: "Deid",
    secret: config.secret,
    baseURL: config.baseURL,
    trustedOrigins: [new URL(config.baseURL).origin],
    advanced: { disableOriginCheck: false, disableCSRFCheck: false },
    database: drizzleAdapter(database.db, { provider: "sqlite", schema: authSchema }),
    emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 12, maxPasswordLength: 128 },
    session: { expiresIn: 60 * 60 * 24, updateAge: 60 * 60, cookieCache: { enabled: false } },
    rateLimit: { enabled: true, window: 60, max: 20 },
  });
}

let auth: ReturnType<typeof createAuth> | undefined;

export function getAuth() {
  const config = {
    secret: process.env.BETTER_AUTH_SECRET ?? "",
    baseURL: process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:3000",
  };
  if (!validAuthConfig(config)) return null;
  if (!auth) {
    const path = resolve(process.env.DATABASE_PATH ?? ".data/deid.sqlite");
    mkdirSync(dirname(path), { recursive: true });
    auth = createAuth(openDatabase(path), config);
  }
  return auth;
}

export async function getOwnerSession(headers: Headers, instance = getAuth()) {
  if (!instance) return null;
  const session = await instance.api.getSession({ headers });
  return session?.user.id === OWNER_ID ? session : null;
}

export async function requireOwner(headers: Headers, instance = getAuth()) {
  if (!instance) throw new AuthAccessError(503);
  const session = await getOwnerSession(headers, instance);
  if (!session) throw new AuthAccessError(401);
  return session;
}
