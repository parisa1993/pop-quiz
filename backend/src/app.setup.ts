import type { NestExpressApplication } from '@nestjs/platform-express';
import { mkdirSync } from 'node:fs';
import type { AppConfig } from './config.js';

/** Shared HTTP setup for the real server and the e2e tests. */
export function configureApp(app: NestExpressApplication, config: AppConfig): void {
  app.setGlobalPrefix('api');
  app.enableCors({ origin: true, credentials: true });
  app.enableShutdownHooks();
  mkdirSync(config.uploadsDir, { recursive: true });
  app.useStaticAssets(config.uploadsDir, { prefix: '/uploads', maxAge: '7d', fallthrough: false });
}
