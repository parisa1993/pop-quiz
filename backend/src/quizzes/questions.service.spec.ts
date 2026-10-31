import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { SessionsService } from '../games/sessions.service.js';
import { seedPlayer, seedQuiz } from '../testing/fixtures.js';
import { createTestDb, type TestDb } from '../testing/test-db.js';
import { QuestionsService } from './questions.service.js';

const trueFalse = (text: string) => ({ type: 'TRUE_FALSE', text, config: { correct: false } });

describe('QuestionsService', () => {
  let db: TestDb;
  let sessions: SessionsService;
  let service: QuestionsService;

  beforeEach(async () => {
    db = await createTestDb();
    sessions = new SessionsService(db.prisma);
    service = new QuestionsService(db.prisma, sessions);
  });

  afterEach(async () => {
    await db.close();
  });

  it('appends new questions at the end', async () => {
    const { quiz } = await seedQuiz(db.prisma);
    const created = await service.create(quiz.id, trueFalse('New'));
    expect(created).toMatchObject({ order: 2, text: 'New', points: 100, config: { correct: false } });
  });

  it('validates input with friendly messages', async () => {
    const { quiz } = await seedQuiz(db.prisma);
    await expect(service.create(quiz.id, { type: 'TRUE_FALSE', text: '' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.create('missing', trueFalse('x'))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates and deletes, keeping order compact', async () => {
    const { quiz, questions } = await seedQuiz(db.prisma);
    const third = await service.create(quiz.id, trueFalse('Third'));
    const updated = await service.update(questions[0].id, { ...trueFalse('Changed'), points: 300 });
    expect(updated).toMatchObject({ text: 'Changed', points: 300 });

    await service.remove(questions[1].id);
    const rest = await db.prisma.question.findMany({ where: { quizId: quiz.id }, orderBy: { order: 'asc' } });
    expect(rest.map((q) => [q.id, q.order])).toEqual([
      [questions[0].id, 0],
      [third.id, 1],
    ]);
    await expect(service.update('missing', trueFalse('x'))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('reorders when every id is given exactly once', async () => {
    const { quiz, questions } = await seedQuiz(db.prisma);
    const ids = [questions[1].id, questions[0].id];
    const result = await service.reorder(quiz.id, ids);
    expect(result.map((q) => q.id)).toEqual(ids);
    expect(result.map((q) => q.order)).toEqual([0, 1]);

    await expect(service.reorder(quiz.id, [questions[0].id])).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.reorder(quiz.id, [questions[0].id, questions[0].id])).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.reorder(quiz.id, 'nope')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses edits while the quiz is being played', async () => {
    const { quiz, questions } = await seedQuiz(db.prisma);
    const ann = await seedPlayer(db.prisma, 'Ann');
    await sessions.start(await sessions.joinQuiz(quiz.id, ann.id));
    await expect(service.create(quiz.id, trueFalse('x'))).rejects.toBeInstanceOf(ConflictException);
    await expect(service.remove(questions[0].id)).rejects.toBeInstanceOf(ConflictException);
  });
});
