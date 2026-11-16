import { defineConfig } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

// Each run owns a fresh database and never uses the owner's local database.
const inheritedDirectory = process.env.DEID_E2E_DIRECTORY;
if (inheritedDirectory && (!basename(inheritedDirectory).startsWith('deid-e2e-') || resolve(inheritedDirectory, '..') !== resolve(tmpdir()))) {
  throw new Error('Invalid inherited E2E temporary directory.');
}
const directory = inheritedDirectory ?? mkdtempSync(join(tmpdir(), 'deid-e2e-'));
process.env.DEID_E2E_DIRECTORY = directory;
const databasePath = join(directory, 'test.sqlite');

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/setup.ts',
  reporter: [['list'], ['./e2e/cleanup-reporter.ts']],
  use: { baseURL: 'http://127.0.0.1:3100' },
  webServer: {
    command: 'npm run start -- --port 3100',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: false,
    env: {
      DATABASE_PATH: databasePath,
      BETTER_AUTH_URL: 'http://127.0.0.1:3100',
      BETTER_AUTH_SECRET: 'test-only-auth-secret-never-for-production-2026',
    },
  },
});
