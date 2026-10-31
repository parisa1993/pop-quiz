import { createTestDb, type TestDb } from '../testing/test-db.js';

describe('PrismaService', () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    await db.close();
  });

  it('connects to SQLite and persists JSON columns', async () => {
    const quiz = await db.prisma.quiz.create({ data: { title: 'Birthday' } });
    await db.prisma.question.create({
      data: { quizId: quiz.id, order: 0, type: 'TRUE_FALSE', text: 'Q', config: { correct: true } },
    });
    const question = await db.prisma.question.findFirstOrThrow({ where: { quizId: quiz.id } });
    expect(question.config).toEqual({ correct: true });
  });

  it('runs lifecycle hooks', async () => {
    await expect(db.prisma.onModuleInit()).resolves.toBeUndefined();
  });
});
