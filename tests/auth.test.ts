import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../lib/db';
import { createAuth, requireOwner } from '../lib/auth';
import { createOwner } from '../lib/auth-owner';

const baseURL = 'http://127.0.0.1:3100';
const owner = { email: 'owner@example.test', password: 'Test-only-password-2026!', name: 'Test owner' };

describe('single-owner authentication', () => {
  let directory: string;
  let database: ReturnType<typeof openDatabase>;
  let auth: ReturnType<typeof createAuth>;
  let client = 0;

  beforeEach(async () => {
    client += 1;
    directory = mkdtempSync(join(tmpdir(), 'deid-auth-test-'));
    database = openDatabase(join(directory, 'auth.sqlite'));
    auth = createAuth(database, { baseURL, secret: 'test-only-auth-secret-never-for-production-2026' });
    await createOwner(owner, database);
  });

  afterEach(() => {
    database?.close();
    if (directory) rmSync(directory, { recursive: true, force: true });
  });

  function request(path: string, body: unknown, headers: Record<string, string> = {}) {
    return auth.handler(new Request(`${baseURL}/api/auth/${path}`, {
      method: 'POST', headers: {
        'Content-Type': 'application/json', Origin: baseURL,
        // Direct-handler requests model independent clients; keep rate limiting enabled.
        'x-forwarded-for': `192.0.2.${client}`, ...headers,
      },
      body: JSON.stringify(body),
    }));
  }

  async function signIn() {
    const response = await request('sign-in/email', owner);
    expect(response.status).toBe(200);
    const cookie = response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    expect(cookie).toContain('session_token=');
    return cookie;
  }

  it('rejects anonymous and forged sessions', async () => {
    await expect(requireOwner(new Headers(), auth)).rejects.toMatchObject({ status: 401 });
    await expect(requireOwner(new Headers({ cookie: 'better-auth.session_token=forged' }), auth))
      .rejects.toMatchObject({ status: 401 });
  });

  it('disables public registration and refuses a second owner', async () => {
    const response = await request('sign-up/email', { ...owner, email: 'outsider@example.test' });
    expect(response.status).toBeGreaterThanOrEqual(400);
    await expect(createOwner({ ...owner, email: 'outsider@example.test' }, database)).rejects.toThrow();
    expect(database.sqlite.prepare('SELECT count(*) AS count FROM auth_user').get()).toEqual({ count: 1 });
  });

  it('rejects incorrect credentials without issuing a session', async () => {
    const response = await request('sign-in/email', { email: owner.email, password: 'Incorrect-password!' });
    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('fails closed without auth configuration and rejects unsafe configuration', async () => {
    await expect(requireOwner(new Headers(), null)).rejects.toMatchObject({ status: 503 });
    expect(() => createAuth(database, { baseURL, secret: 'too-short' })).toThrow();
    expect(() => createAuth(database, { baseURL: 'https://external.example', secret: 'test-only-auth-secret-never-for-production-2026' })).toThrow();
  });

  it('stores a password hash and enforces one owner at the database boundary', () => {
    const account = database.sqlite.prepare('SELECT password FROM auth_account').get() as { password: string };
    expect(account.password).not.toBe(owner.password);
    expect(account.password).not.toContain(owner.password);
    expect(() => database.sqlite.prepare('INSERT INTO auth_user (id, name, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run('outsider', 'Outsider', 'outsider@example.test', Date.now(), Date.now())).toThrow();
  });

  it('authenticates the owner and invalidates the session on logout', async () => {
    const cookie = await signIn();
    const headers = new Headers({ cookie });
    const session = await requireOwner(headers, auth);
    expect(session.user.id).toBe('deid-owner');
    expect(session.user.email).toBe(owner.email);
    const response = await request('sign-out', {}, { cookie });
    expect(response.status).toBe(200);
    await expect(requireOwner(headers, auth)).rejects.toMatchObject({ status: 401 });
  });

  it('rejects a foreign origin without invalidating the valid session', async () => {
    const cookie = await signIn();
    const response = await request('sign-out', {}, { cookie, Origin: 'https://attacker.example' });
    expect(response.status).toBe(403);
    await expect(requireOwner(new Headers({ cookie }), auth)).resolves.toMatchObject({ user: { id: 'deid-owner' } });
  });

  it('rejects external callback URLs', async () => {
    const response = await request('sign-in/email', { ...owner, callbackURL: 'https://attacker.example' });
    expect(response.status).toBe(403);
  });
});
