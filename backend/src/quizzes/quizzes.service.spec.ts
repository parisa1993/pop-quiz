import { ConflictException, NotFoundException } from '@nestjs/common';
import type { RealtimeService } from '../games/realtime.service.js';
import { SessionsService } from '../games/sessions.service.js';
import { seedPlayer, seedQuiz } from '../testing/fixtures.js';
import { createTestDb, type TestDb } from '../testing/test-db.js';
import { QuizzesService } from './quizzes.service.js';

describe('QuizzesService', () => {
  let db: TestDb;
  let sessions: SessionsService;
  let realtime: { gamesChanged: ReturnType<typeof vi.fn> };
  let service: QuizzesService;

  beforeEach(async () => {
    db = await createTestDb();
    sessions = new SessionsService(db.prisma);
    realtime = { gamesChanged: vi.fn() };
    service = new QuizzesService(db.prisma, sessions, realtime as unknown as RealtimeService);
  });

  afterEach(async () => {
    await db.close();
  });

  it('creates, updates and gets quizzes', async () => {
    const created = await service.create({ title: 'Party', description: 'Fun' });
    expect(created).toMatchObject({ title: 'Party', enabled: false, questionCount: 0, questions: [] });
    expect(realtime.gamesChanged).not.toHaveBeenCalled();

    const updated = await service.update(created.id, { enabled: true, title: 'Big Party' });
    expect(updated).toMatchObject({ title: 'Big Party', enabled: true });
    expect(realtime.gamesChanged).toHaveBeenCalled();

    await expect(service.get('missing')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.update('missing', { title: 'x' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists quizzes with play statistics', async () => {
    const { quiz } = await seedQuiz(db.prisma);
    const ann = await seedPlayer(db.prisma, 'Ann');
    const sessionId = await sessions.joinQuiz(quiz.id, ann.id);

    let [summary] = await service.list();
    expect(summary).toMatchObject({ questionCount: 2, playerCount: 0, sessionCount: 0 });
    expect(summary.activeSession).toEqual({ id: sessionId, status: 'LOBBY', playerCount: 1 });

    await sessions.start(sessionId);
    [summary] = await service.list();
    expect(summary).toMatchObject({ playerCount: 1, sessionCount: 1 });
  });

  it('blocks deleting a quiz that is being played', async () => {
    const { quiz } = await seedQuiz(db.prisma);
    const ann = await seedPlayer(db.prisma, 'Ann');
    const sessionId = await sessions.joinQuiz(quiz.id, ann.id);
    await sessions.start(sessionId);
    await expect(service.remove(quiz.id)).rejects.toBeInstanceOf(ConflictException);

    await sessions.finish(sessionId);
    await service.remove(quiz.id);
    expect(await db.prisma.quiz.count()).toBe(0);
    await expect(service.remove(quiz.id)).rejects.toBeInstanceOf(NotFoundException);
  });
});
