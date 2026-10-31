import path from 'node:path';
import { ADMIN_PASSWORD_DEFAULT } from '@pop-quiz/shared';

export interface AppConfig {
  port: number;
  adminPassword: string;
  jwtSecret: string;
  databaseUrl: string;
  uploadsDir: string;
  frontendDist: string;
}

/** Reads settings from the environment. Paths are relative to the backend folder (npm's cwd). */
export function loadConfig(env: NodeJS.ProcessEnv = process.env, cwd = process.cwd()): AppConfig {
  return {
    port: Number(env['PORT'] ?? 3000),
    adminPassword: env['ADMIN_PASSWORD'] ?? ADMIN_PASSWORD_DEFAULT,
    jwtSecret: env['JWT_SECRET'] ?? 'pop-quiz-dev-secret',
    databaseUrl: env['DATABASE_URL'] ?? `file:${path.join(cwd, 'prisma', 'dev.db')}`,
    uploadsDir: path.resolve(cwd, env['UPLOADS_DIR'] ?? 'uploads'),
    frontendDist: path.resolve(cwd, env['FRONTEND_DIST'] ?? '../frontend/dist/pop-quiz/browser'),
  };
}

export const APP_CONFIG = Symbol('APP_CONFIG');
