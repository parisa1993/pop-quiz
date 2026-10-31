import { defineConfig, devices } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Each run gets a throwaway database and uploads folder. The config is also loaded by
// workers, so the folder is created once and shared through the environment.
process.env['POP_QUIZ_E2E_DATA'] ??= mkdtempSync(path.join(tmpdir(), 'pop-quiz-e2e-'));
const tmp = process.env['POP_QUIZ_E2E_DATA'];
const PORT = 3100;

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // The backend serves the built Angular app, exactly like production.
  webServer: {
    command: 'npm run start:prod -w @pop-quiz/backend',
    url: `http://localhost:${PORT}/api/games`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PORT: String(PORT),
      DATABASE_URL: `file:${path.join(tmp, 'e2e.db')}`,
      UPLOADS_DIR: path.join(tmp, 'uploads'),
      JWT_SECRET: 'e2e-secret',
    },
  },
});
