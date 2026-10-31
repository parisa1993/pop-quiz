import path from 'node:path';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('uses sensible defaults', () => {
    const config = loadConfig({}, '/app/backend');
    expect(config.port).toBe(3000);
    expect(config.adminPassword).toBe('9999');
    expect(config.databaseUrl).toBe(`file:${path.join('/app/backend', 'prisma', 'dev.db')}`);
    expect(config.uploadsDir).toBe(path.resolve('/app/backend', 'uploads'));
  });

  it('reads overrides from the environment', () => {
    const config = loadConfig(
      {
        PORT: '4000',
        ADMIN_PASSWORD: '1234',
        JWT_SECRET: 's',
        DATABASE_URL: 'file:x.db',
        UPLOADS_DIR: 'up',
      },
      '/app/backend',
    );
    expect(config).toMatchObject({
      port: 4000,
      adminPassword: '1234',
      jwtSecret: 's',
      databaseUrl: 'file:x.db',
      uploadsDir: path.resolve('/app/backend', 'up'),
    });
  });
});
