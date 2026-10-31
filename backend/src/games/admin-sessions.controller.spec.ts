import { NotFoundException } from '@nestjs/common';
import { AdminSessionsController } from './admin-sessions.controller.js';
import type { RealtimeService } from './realtime.service.js';
import type { ResultsService } from './results.service.js';
import type { SessionsService } from './sessions.service.js';

describe('AdminSessionsController', () => {
  const session = { id: 's1' };
  const sessions = {
    openSession: vi.fn(async () => session),
    activeSessionInfo: vi.fn(async () => ({ id: 's1', status: 'LOBBY', playerCount: 3 })),
    toSummary: vi.fn((s: { id: string }, playerCount: number) => ({ id: s.id, playerCount })),
    listSessions: vi.fn(async () => [{ id: 's1' }]),
    loadContext: vi.fn(async (id: string) => (id === 's1' ? { session, players: [{}, {}] } : null)),
  } as unknown as SessionsService;
  const results = {
    getResults: vi.fn(async () => ({ leaderboard: [] })),
  } as unknown as ResultsService;
  const realtime = { gamesChanged: vi.fn() } as unknown as RealtimeService;
  const controller = new AdminSessionsController(sessions, results, realtime);

  it('opens a lobby and tells game lists', async () => {
    expect(await controller.open('z')).toEqual({ id: 's1', playerCount: 3 });
    expect(realtime.gamesChanged).toHaveBeenCalled();
  });

  it('lists sessions and gets one', async () => {
    expect(await controller.list('z')).toEqual([{ id: 's1' }]);
    expect(await controller.get('s1')).toEqual({ id: 's1', playerCount: 2 });
    await expect(controller.get('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns results', async () => {
    expect(await controller.getResults('s1')).toEqual({ leaderboard: [] });
  });
});
