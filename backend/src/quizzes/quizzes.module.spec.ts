import { Test } from '@nestjs/testing';
import { AdminGuard } from '../auth/admin.guard.js';
import { AuthService } from '../auth/auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { QuestionsService } from './questions.service.js';
import { QuizzesModule } from './quizzes.module.js';
import { QuizzesService } from './quizzes.service.js';

describe('QuizzesModule', () => {
  it('wires quiz and question services', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [QuizzesModule] })
      .useMocker((token) => {
        if (token === PrismaService) return {};
        if (token === AuthService || token === AdminGuard) return { canActivate: () => true };
        return undefined;
      })
      .compile();

    expect(moduleRef.get(QuizzesService)).toBeInstanceOf(QuizzesService);
    expect(moduleRef.get(QuestionsService)).toBeInstanceOf(QuestionsService);
  });
});
