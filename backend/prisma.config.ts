import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    url: process.env['DATABASE_URL'] ?? `file:${path.join(import.meta.dirname, 'prisma', 'dev.db')}`,
  },
});
