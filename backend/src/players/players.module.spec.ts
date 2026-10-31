import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { PlayersController } from './players.controller.js';
import { PlayersModule } from './players.module.js';
import { PlayersService } from './players.service.js';

describe('PlayersModule', () => {
  it('wires the controller and service', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [PlayersModule] })
      .useMocker((token) => (token === PrismaService ? {} : undefined))
      .compile();
    expect(moduleRef.get(PlayersService)).toBeInstanceOf(PlayersService);
    expect(moduleRef.get(PlayersController)).toBeInstanceOf(PlayersController);
  });
});
