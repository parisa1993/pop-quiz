import { Test } from '@nestjs/testing';
import { AuthService } from '../auth/auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { GameGateway } from './game.gateway.js';
import { GamesModule } from './games.module.js';
import { RealtimeService } from './realtime.service.js';
import { SessionsService } from './sessions.service.js';

describe('GamesModule', () => {
  it('wires the gateway and services', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [GamesModule],
      providers: [],
    })
      .useMocker((token) => {
        if (token === PrismaService) return {};
        if (token === AuthService) return { isAdminToken: async () => false };
        return undefined;
      })
      .compile();

    expect(moduleRef.get(GameGateway)).toBeInstanceOf(GameGateway);
    expect(moduleRef.get(SessionsService)).toBeInstanceOf(SessionsService);
    expect(moduleRef.get(RealtimeService)).toBeInstanceOf(RealtimeService);
  });
});
