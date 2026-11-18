import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadConfig } from './config.js';

export const KEEP_BACKUPS = 10;

/** Path of the SQLite file behind a `file:` DATABASE_URL, or null for anything else. */
export function sqlitePath(databaseUrl: string): string | null {
  return databaseUrl.startsWith('file:') ? databaseUrl.slice('file:'.length) : null;
}

/**
 * Copies the database into a `backups/` folder next to it before the app starts (and before
 * migrations run), keeping the newest `keep` copies. Deploys never touch the original file.
 */
export function backupDatabase(
  databaseUrl: string,
  now = new Date(),
  keep = KEEP_BACKUPS,
): string | null {
  const file = sqlitePath(databaseUrl);
  if (!file || !existsSync(file)) return null;

  const dir = path.join(path.dirname(file), 'backups');
  mkdirSync(dir, { recursive: true });
  const name = path.basename(file, path.extname(file));
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const target = path.join(dir, `${name}-${stamp}.db`);
  copyFileSync(file, target);

  const old = readdirSync(dir)
    .filter((f) => f.startsWith(`${name}-`) && f.endsWith('.db'))
    .sort()
    .reverse()
    .slice(keep);
  for (const f of old) rmSync(path.join(dir, f), { force: true });
  return target;
}

// `node dist/src/backup.js` runs it on startup (see start:prod).
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const saved = backupDatabase(loadConfig().databaseUrl);
  console.log(
    saved ? `💾 Database backed up to ${saved}` : '💾 No database yet, nothing to back up',
  );
}
