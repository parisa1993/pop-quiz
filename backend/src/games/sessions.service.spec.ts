import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { seedPlayer, seedQuiz } from '../testing/fixtures.js';
import { createTestDb, type TestDb } from '../testing/test-db.js';
import { SessionsService } from './sessions.service.js';

describe('SessionsService', () => {
  let db: TestDb;
  let service: SessionsService;

  beforeEach(async () => {
    db = await createTestDb();
    service = new SessionsService(db.prisma);
  });

  afterEach(async () => {
    await db.close();
  });

  async function startedGame() {
    const { quiz, questions } = await seedQuiz(db.prisma);
    const ann = await seedPlayer(db.prisma, 'Ann');
    const ben = await seedPlayer(db.prisma, 'Ben');
    const sessionId = await service.joinQuiz(quiz.id, ann.id);
    await service.joinQuiz(quiz.id, ben.id);
    await service.start(sessionId);
    return { quiz, questions, ann, ben, sessionId };
  }

  describe('joining', () => {
    it('creates one lobby per quiz and reuses it', async () => {
      const { quiz } = await seedQuiz(db.prisma);
      const ann = await seedPlayer(db.prisma, 'Ann');
      const first = await service.joinQuiz(quiz.id, ann.id);
      const again = await service.joinQuiz(quiz.id, ann.id);
      expect(again).toBe(first);
      expect(await service.isPlayerInSession(first, ann.id)).toBe(true);
      expect(await service.activeSessionInfo(quiz.id)).toEqual({
        id: first,
        status: 'LOBBY',
        playerCount: 1,
      });
    });

    it('refuses disabled quizzes, unknown players and empty quizzes', async () => {
      const { quiz } = await seedQuiz(db.prisma, { enabled: false });
      const ann = await seedPlayer(db.prisma, 'Ann');
      await expect(service.joinQuiz(quiz.id, ann.id)).rejects.toBeInstanceOf(NotFoundException);
      await db.prisma.quiz.update({ where: { id: quiz.id }, data: { enabled: true } });
      await expect(service.joinQuiz(quiz.id, 'ghost')).rejects.toBeInstanceOf(NotFoundException);

      const empty = await db.prisma.quiz.create({ data: { title: 'Empty', enabled: true } });
      await expect(service.openSession(empty.id)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.openSession('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lists only enabled quizzes with questions', async () => {
      await seedQuiz(db.prisma, { title: 'On' });
      await seedQuiz(db.prisma, { title: 'Off', enabled: false });
      await db.prisma.quiz.create({ data: { title: 'Empty', enabled: true } });
      const games = await service.listGames();
      expect(games.map((g) => g.title)).toEqual(['On']);
      expect(games[0]).toMatchObject({ questionCount: 2, session: null });
    });
  });

  describe('host controls', () => {
    it('starts, moves within bounds, reveals and finishes', async () => {
      const { sessionId, questions } = await startedGame();
      await expect(service.start(sessionId)).rejects.toBeInstanceOf(ConflictException);
      await expect(service.move(sessionId, -1)).rejects.toThrow('Already at the first question');
      await service.move(sessionId, 1);
      await expect(service.move(sessionId, 1)).rejects.toThrow('That was the last question');

      await service.reveal(sessionId);
      await service.reveal(sessionId);
      let ctx = await service.loadContext(sessionId);
      expect([...ctx!.revealedIds]).toEqual([questions[1].id]);

      await service.finish(sessionId);
      await service.finish(sessionId);
      ctx = await service.loadContext(sessionId);
      expect(ctx!.session.status).toBe('FINISHED');
      expect(ctx!.revealedIds.size).toBe(2);
      await expect(service.move(sessionId, 1)).rejects.toThrow("The game isn't running");
      expect(await service.hasLiveSession(ctx!.quiz.id)).toBe(false);
    });

    it('reports unknown sessions', async () => {
      await expect(service.start('nope')).rejects.toBeInstanceOf(NotFoundException);
      expect(await service.loadContext('nope')).toBeNull();
    });
  });

  describe('answers', () => {
    it('grades and stores the first answer only', async () => {
      const { sessionId, questions, ann } = await startedGame();
      await service.submitAnswer(sessionId, ann.id, questions[0].id, { value: true });
      await expect(
        service.submitAnswer(sessionId, ann.id, questions[0].id, { value: false }),
      ).rejects.toThrow('You already answered this question');
      const stored = await db.prisma.answer.findFirstOrThrow();
      expect(stored).toMatchObject({ isCorrect: true, points: 100 });
    });

    it('rejects closed questions, outsiders, bad payloads and revealed questions', async () => {
      const { sessionId, questions, ann, ben } = await startedGame();
      const outsider = await seedPlayer(db.prisma, 'Cat');
      await expect(
        service.submitAnswer(sessionId, ann.id, questions[1].id, { optionId: 'a' }),
      ).rejects.toThrow('This question is closed');
      await expect(
        service.submitAnswer(sessionId, outsider.id, questions[0].id, { value: true }),
      ).rejects.toThrow('Join the game first');
      await expect(
        service.submitAnswer(sessionId, ann.id, questions[0].id, { value: 1 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await service.reveal(sessionId);
      await expect(
        service.submitAnswer(sessionId, ben.id, questions[0].id, { value: true }),
      ).rejects.toThrow('Too late');
    });
  });

  describe('snapshots', () => {
    it('hides results until reveal and ranks players', async () => {
      const { sessionId, questions, ann, ben } = await startedGame();
      await service.submitAnswer(sessionId, ann.id, questions[0].id, { value: true });
      await service.submitAnswer(sessionId, ben.id, questions[0].id, { value: false });

      let ctx = (await service.loadContext(sessionId))!;
      const connected = new Set([ann.id]);
      let annView = service.buildPlayerState(ctx, ann.id, connected);
      expect(annView).toMatchObject({
        status: 'IN_PROGRESS',
        revealed: false,
        myResult: null,
        myScore: 0,
      });
      expect(annView.myAnswer).toEqual({ value: true });
      expect(annView.players).toEqual([
        { id: ann.id, username: 'Ann', connected: true },
        { id: ben.id, username: 'Ben', connected: false },
      ]);

      const hostView = service.buildHostState(ctx, connected);
      expect(hostView).toMatchObject({
        answeredCount: 2,
        correctAnswerText: 'True',
        revealed: false,
      });
      expect(hostView.players.every((p) => p.answeredCurrent)).toBe(true);
      expect(hostView.leaderboard[0]).toMatchObject({ username: 'Ann', score: 100, rank: 1 });

      await service.reveal(sessionId);
      ctx = (await service.loadContext(sessionId))!;
      annView = service.buildPlayerState(ctx, ann.id, connected);
      expect(annView).toMatchObject({
        revealed: true,
        myResult: { isCorrect: true, points: 100 },
        myScore: 100,
      });

      await service.finish(sessionId);
      ctx = (await service.loadContext(sessionId))!;
      const benView = service.buildPlayerState(ctx, ben.id, connected);
      expect(benView.question).toBeNull();
      expect(benView.final).toMatchObject({ rank: 2, score: 0, playerCount: 2 });
    });

    it('lists and summarizes sessions', async () => {
      const { quiz, sessionId } = await startedGame();
      const sessions = await service.listSessions(quiz.id);
      expect(sessions).toEqual([
        expect.objectContaining({
          id: sessionId,
          status: 'IN_PROGRESS',
          playerCount: 2,
          finishedAt: null,
        }),
      ]);
    });
  });
});
