import { ServerEvents } from '@pop-quiz/shared';
import type { Server } from 'socket.io';
import { RealtimeService, sessionRoom } from './realtime.service.js';
import type { SessionContext, SessionsService } from './sessions.service.js';

describe('RealtimeService', () => {
  const ctx = { session: { id: 's1' } } as SessionContext;
  const sessions = {
    loadContext: vi.fn(async (id: string) => (id === 's1' ? ctx : null)),
    buildPlayerState: vi.fn((_c, playerId: string) => ({ for: playerId })),
    buildHostState: vi.fn(() => ({ host: true })),
  } as unknown as SessionsService;

  const player = { data: { playerId: 'p1' }, emit: vi.fn() };
  const admin = { data: { isAdmin: true }, emit: vi.fn() };
  const stranger = { data: {}, emit: vi.fn() };
  const server = {
    in: vi.fn(() => ({ fetchSockets: async () => [player, admin, stranger] })),
    emit: vi.fn(),
  } as unknown as Server;

  it('does nothing before the gateway attaches the server', async () => {
    const service = new RealtimeService(sessions);
    await service.broadcastSession('s1');
    service.gamesChanged();
    expect(sessions.loadContext).not.toHaveBeenCalled();
  });

  it('sends personal state to gamers and host state to admins', async () => {
    const service = new RealtimeService(sessions);
    service.attach(server);
    await service.broadcastSession('s1');

    expect(server.in).toHaveBeenCalledWith(sessionRoom('s1'));
    expect(sessions.buildPlayerState).toHaveBeenCalledWith(ctx, 'p1', new Set(['p1']));
    expect(player.emit).toHaveBeenCalledWith(ServerEvents.GameState, { for: 'p1' });
    expect(admin.emit).toHaveBeenCalledWith(ServerEvents.HostState, { host: true });
    expect(stranger.emit).not.toHaveBeenCalled();
  });

  it('skips unknown sessions and broadcasts list changes', async () => {
    const service = new RealtimeService(sessions);
    service.attach(server);
    vi.mocked(server.in).mockClear();
    await service.broadcastSession('missing');
    expect(server.in).not.toHaveBeenCalled();
    service.gamesChanged();
    expect(server.emit).toHaveBeenCalledWith(ServerEvents.GamesChanged);
  });
});
