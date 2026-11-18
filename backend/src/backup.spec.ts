import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { backupDatabase, sqlitePath } from './backup.js';

describe('backupDatabase', () => {
  let dir: string;
  let db: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'pop-quiz-backup-'));
    db = path.join(dir, 'pop-quiz.db');
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('reads the SQLite path from the URL', () => {
    expect(sqlitePath('file:/data/pop-quiz.db')).toBe('/data/pop-quiz.db');
    expect(sqlitePath('postgres://x')).toBeNull();
  });

  it('does nothing before the database exists', () => {
    expect(backupDatabase(`file:${db}`)).toBeNull();
    expect(existsSync(path.join(dir, 'backups'))).toBe(false);
  });

  it('copies the database without touching the original', () => {
    writeFileSync(db, 'quizzes');
    const target = backupDatabase(`file:${db}`, new Date('2026-11-18T10:00:00.000Z'))!;
    expect(path.basename(target)).toBe('pop-quiz-2026-11-18T10-00-00-000Z.db');
    expect(readFileSync(target, 'utf8')).toBe('quizzes');
    expect(readFileSync(db, 'utf8')).toBe('quizzes');
  });

  it('keeps only the newest backups', () => {
    writeFileSync(db, 'v');
    for (let day = 1; day <= 5; day++) {
      backupDatabase(`file:${db}`, new Date(`2026-11-0${day}T00:00:00.000Z`), 3);
    }
    const kept = readdirSync(path.join(dir, 'backups')).sort();
    expect(kept).toEqual([
      'pop-quiz-2026-11-03T00-00-00-000Z.db',
      'pop-quiz-2026-11-04T00-00-00-000Z.db',
      'pop-quiz-2026-11-05T00-00-00-000Z.db',
    ]);
  });
});
