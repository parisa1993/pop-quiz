import { existsSync } from 'node:fs';
import { createTestDb } from './test-db.js';

describe('createTestDb', () => {
  it('creates an isolated, migrated database and cleans it up', async () => {
    const db = await createTestDb();
    expect(await db.prisma.quiz.count()).toBe(0);
    expect(db.config.databaseUrl).toContain(db.dir);
    await db.close();
    expect(existsSync(db.dir)).toBe(false);
  });
});
