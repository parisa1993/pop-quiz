import type { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { configureApp } from './app.setup.js';
import { loadConfig } from './config.js';

describe('configureApp', () => {
  it('sets the API prefix, CORS and the uploads folder', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'pop-quiz-setup-'));
    const uploadsDir = path.join(dir, 'uploads');
    const app = {
      setGlobalPrefix: vi.fn(),
      enableCors: vi.fn(),
      enableShutdownHooks: vi.fn(),
      useStaticAssets: vi.fn(),
    };

    configureApp(app as unknown as NestExpressApplication, { ...loadConfig({}), uploadsDir });

    expect(app.setGlobalPrefix).toHaveBeenCalledWith('api');
    expect(app.enableCors).toHaveBeenCalled();
    expect(app.useStaticAssets).toHaveBeenCalledWith(
      uploadsDir,
      expect.objectContaining({ prefix: '/uploads' }),
    );
    expect(existsSync(uploadsDir)).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });
});
