import { NotFoundException } from '@nestjs/common';
import { seedPlayer, seedQuiz } from '../testing/fixtures.js';
import { createTestDb, type TestDb } from '../testing/test-db.js';
import { ResultsService } from './results.service.js';
import { SessionsService } from './sessions.service.js';

describe('ResultsService', () => {
  let db: TestDb;
  let sessions: SessionsService;
  let results: ResultsService;

  beforeEach(async () => {
    db = await createTestDb();
    sessions = new SessionsService(db.prisma);
    results = new ResultsService(sessions);
  });

  afterEach(async () => {
    await db.close();
  });

  it('builds the leaderboard and readable answers', async () => {
    const { quiz, questions } = await seedQuiz(db.prisma);
    const ann = await seedPlayer(db.prisma, 'Ann');
    const ben = await seedPlayer(db.prisma, 'Ben');
    const sessionId = await sessions.joinQuiz(quiz.id, ann.id);
    await sessions.joinQuiz(quiz.id, ben.id);
    await sessions.start(sessionId);
    await sessions.submitAnswer(sessionId, ann.id, questions[0].id, { value: true });
    await sessions.move(sessionId, 1);
    await sessions.submitAnswer(sessionId, ann.id, questions[1].id, { optionId: 'a' });
    await sessions.submitAnswer(sessionId, ben.id, questions[1].id, { optionId: 'b' });
    await sessions.finish(sessionId);

    const result = await results.getResults(sessionId);
    expect(result.session).toMatchObject({
      quizTitle: 'Birthday',
      status: 'FINISHED',
      playerCount: 2,
    });
    expect(result.leaderboard.map((p) => [p.username, p.score, p.rank])).toEqual([
      ['Ann', 300, 1],
      ['Ben', 0, 2],
    ]);
    expect(result.questions.map((q) => q.correctAnswer)).toEqual(['True', 'Chocolate']);
    expect(result.answers).toContainEqual({
      playerId: ben.id,
      questionId: questions[1].id,
      answerText: 'Lemon',
      isCorrect: false,
      points: 0,
    });
  });

  it('throws for unknown sessions', async () => {
    await expect(results.getResults('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});
