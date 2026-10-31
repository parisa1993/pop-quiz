import { seedPlayer, seedQuiz } from './fixtures.js';
import { createTestDb, type TestDb } from './test-db.js';

describe('fixtures', () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    await db.close();
  });

  it('seeds a quiz with two ordered questions and players', async () => {
    const { quiz, questions } = await seedQuiz(db.prisma, { enabled: false, title: 'T' });
    expect(quiz).toMatchObject({ title: 'T', enabled: false });
    expect(questions.map((q) => [q.type, q.order])).toEqual([
      ['TRUE_FALSE', 0],
      ['SINGLE_CHOICE', 1],
    ]);
    expect(await seedPlayer(db.prisma, 'Ann')).toMatchObject({
      username: 'Ann',
      usernameKey: 'ann',
    });
  });
});
