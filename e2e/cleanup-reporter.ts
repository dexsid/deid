import { rmSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import type { Reporter } from '@playwright/test/reporter';

export default class CleanupReporter implements Reporter {
  async onExit() {
    // Reporter exit runs after runner task teardown, including the web server.
    const directory = process.env.DEID_E2E_DIRECTORY;
    if (!directory || !basename(directory).startsWith('deid-e2e-') || resolve(directory, '..') !== resolve(tmpdir())) {
      throw new Error('Refusing to remove an unrecognized E2E directory.');
    }
    rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}
