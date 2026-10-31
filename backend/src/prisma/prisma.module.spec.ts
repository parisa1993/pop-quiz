import { Test } from '@nestjs/testing';
import { AppConfigModule } from '../config.module.js';
import { createTestDb } from '../testing/test-db.js';
import { PrismaModule } from './prisma.module.js';
import { PrismaService } from './prisma.service.js';

describe('PrismaModule', () => {
  it('provides a connected PrismaService', async () => {
    const db = await createTestDb();
    const moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule.forRoot(db.config), PrismaModule],
    }).compile();
    // Prisma's constructor returns a proxy, so check behaviour rather than `instanceof`.
    const prisma = moduleRef.get(PrismaService);
    expect(await prisma.quiz.count()).toBe(0);
    await moduleRef.close();
    await db.close();
  });
});
