import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadConfig, type AppConfig } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';

const migrationsDir = path.resolve(import.meta.dirname, '..', '..', 'prisma', 'migrations');

/** Reads every migration in order so tests run against the real schema. */
function migrationStatements(): string[] {
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .flatMap((dir) =>
      readFileSync(path.join(migrationsDir, dir, 'migration.sql'), 'utf8').split(';'),
    )
    .map((s) => s.replace(/^\s*--.*$/gm, '').trim())
    .filter(Boolean);
}

export interface TestDb {
  prisma: PrismaService;
  config: AppConfig;
  dir: string;
  close(): Promise<void>;
}

/** Creates an isolated, migrated SQLite database in a temp folder. */
export async function createTestDb(): Promise<TestDb> {
  const dir = mkdtempSync(path.join(tmpdir(), 'pop-quiz-'));
  const config: AppConfig = {
    ...loadConfig({}),
    databaseUrl: `file:${path.join(dir, 'test.db')}`,
    uploadsDir: path.join(dir, 'uploads'),
    frontendDist: path.join(dir, 'no-frontend'),
    jwtSecret: 'test-secret',
  };
  const prisma = new PrismaService(config);
  await prisma.$connect();
  for (const sql of migrationStatements()) await prisma.$executeRawUnsafe(sql);
  return {
    prisma,
    config,
    dir,
    async close() {
      await prisma.$disconnect();
      try {
        rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      } catch {
        // Windows can keep the SQLite file locked briefly; the OS cleans temp folders anyway.
      }
    },
  };
}
