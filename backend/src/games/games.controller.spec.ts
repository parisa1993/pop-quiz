import { BadRequestException } from '@nestjs/common';
import { GamesController } from './games.controller.js';
import type { RealtimeService } from './realtime.service.js';
import type { SessionsService } from './sessions.service.js';

describe('GamesController', () => {
  const sessions = {
    listGames: vi.fn(async () => [{ quizId: 'z' }]),
    joinQuiz: vi.fn(async () => 's1'),
  } as unknown as SessionsService;
  const realtime = { gamesChanged: vi.fn() } as unknown as RealtimeService;
  const controller = new GamesController(sessions, realtime);

  it('lists playable games', async () => {
    expect(await controller.list()).toEqual([{ quizId: 'z' }]);
  });

  it('joins a game and notifies lists', async () => {
    expect(await controller.join('z', { playerId: 'p' })).toEqual({ sessionId: 's1' });
    expect(sessions.joinQuiz).toHaveBeenCalledWith('z', 'p');
    expect(realtime.gamesChanged).toHaveBeenCalled();
  });

  it('requires a player id', async () => {
    await expect(controller.join('z', {} as never)).rejects.toBeInstanceOf(BadRequestException);
  });
});
