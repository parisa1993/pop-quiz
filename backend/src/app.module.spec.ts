import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { AppModule } from './app.module.js';
import { loadConfig } from './config.js';
import { createTestDb } from './testing/test-db.js';

describe('AppModule', () => {
  it('imports every feature module', () => {
    const dynamic = AppModule.forRoot({ ...loadConfig({}), frontendDist: '/does/not/exist' });
    expect(dynamic.imports).toHaveLength(7);
  });

  it('serves the built frontend when it exists', async () => {
    const db = await createTestDb();
    const frontendDist = path.join(db.dir, 'browser');
    mkdirSync(frontendDist);
    const dynamic = AppModule.forRoot({ ...db.config, frontendDist });
    expect(dynamic.imports).toHaveLength(8);
    await db.close();
  });
});
