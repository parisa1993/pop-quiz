import { ConflictException } from '@nestjs/common';
import type { Server } from 'socket.io';
import type { AuthService } from '../auth/auth.service.js';
import { GameGateway, toAck } from './game.gateway.js';
import type { RealtimeService } from './realtime.service.js';
import type { SessionsService } from './sessions.service.js';

function fakeSocket(data: Record<string, unknown> = {}, token?: string) {
  return {
    data,
    handshake: { auth: token ? { token } : {} },
    join: vi.fn(),
    leave: vi.fn(),
  } as never as Parameters<GameGateway['join']>[0];
}

describe('GameGateway', () => {
  let sessions: Record<string, ReturnType<typeof vi.fn>>;
  let realtime: Record<string, ReturnType<typeof vi.fn>>;
  let gateway: GameGateway;

  beforeEach(() => {
    sessions = {
      isPlayerInSession: vi.fn(async () => true),
      submitAnswer: vi.fn(async () => undefined),
      loadContext: vi.fn(async (id: string) => (id === 's1' ? {} : null)),
      start: vi.fn(async () => undefined),
      move: vi.fn(async () => undefined),
      reveal: vi.fn(async () => undefined),
      finish: vi.fn(async () => undefined),
    };
    realtime = {
      attach: vi.fn(),
      broadcastSession: vi.fn(async () => undefined),
      gamesChanged: vi.fn(),
    };
    const auth = {
      isAdminToken: vi.fn(async (t: unknown) => t === 'admin'),
    } as unknown as AuthService;
    gateway = new GameGateway(
      sessions as unknown as SessionsService,
      realtime as unknown as RealtimeService,
      auth,
    );
  });

  it('attaches the server and flags admins on connect', async () => {
    gateway.afterInit({} as Server);
    expect(realtime.attach).toHaveBeenCalled();
    const admin = fakeSocket({}, 'admin');
    const gamer = fakeSocket({}, 'nope');
    await gateway.handleConnection(admin);
    await gateway.handleConnection(gamer);
    expect(admin.data.isAdmin).toBe(true);
    expect(gamer.data.isAdmin).toBe(false);
  });

  it('joins a gamer into the session room', async () => {
    const socket = fakeSocket();
    expect(await gateway.join(socket, { sessionId: 's1', playerId: 'p1' })).toEqual({ ok: true });
    expect(socket.join).toHaveBeenCalledWith('session:s1');
    expect(socket.data).toMatchObject({ sessionId: 's1', playerId: 'p1' });
    expect(realtime.broadcastSession).toHaveBeenCalledWith('s1');

    await gateway.join(socket, { sessionId: 's2', playerId: 'p1' });
    expect(socket.leave).toHaveBeenCalledWith('session:s1');
  });

  it('rejects invalid joins', async () => {
    expect(await gateway.join(fakeSocket(), {} as never)).toEqual({
      ok: false,
      error: 'Missing game or player',
    });
    sessions.isPlayerInSession.mockResolvedValue(false);
    expect(await gateway.join(fakeSocket(), { sessionId: 's1', playerId: 'p1' })).toMatchObject({
      ok: false,
    });
  });

  it('accepts answers only from joined gamers', async () => {
    const payload = { value: true };
    expect(
      await gateway.answer(fakeSocket(), { sessionId: 's1', questionId: 'q', payload }),
    ).toEqual({
      ok: false,
      error: 'Join the game first',
    });
    const joined = fakeSocket({ playerId: 'p1', sessionId: 's1' });
    expect(await gateway.answer(joined, { sessionId: 's1', questionId: 'q', payload })).toEqual({
      ok: true,
    });
    expect(sessions.submitAnswer).toHaveBeenCalledWith('s1', 'p1', 'q', payload);
    expect(
      await gateway.answer(joined, { sessionId: 's1', questionId: '', payload }),
    ).toMatchObject({ ok: false });
  });

  it('runs host controls for admins only', async () => {
    const admin = fakeSocket({ isAdmin: true });
    expect(await gateway.start(fakeSocket(), { sessionId: 's1' })).toEqual({
      ok: false,
      error: 'Admin login required',
    });
    expect(await gateway.start(admin, { sessionId: 's1' })).toEqual({ ok: true });
    expect(realtime.gamesChanged).toHaveBeenCalled();
    await gateway.next(admin, { sessionId: 's1' });
    expect(sessions.move).toHaveBeenCalledWith('s1', 1);
    await gateway.prev(admin, { sessionId: 's1' });
    expect(sessions.move).toHaveBeenCalledWith('s1', -1);
    await gateway.reveal(admin, { sessionId: 's1' });
    await gateway.finish(admin, { sessionId: 's1' });
    expect(sessions.reveal).toHaveBeenCalled();
    expect(sessions.finish).toHaveBeenCalled();
    expect(await gateway.next(admin, {} as never)).toEqual({ ok: false, error: 'Missing game' });
  });

  it('lets the admin watch an existing session', async () => {
    const admin = fakeSocket({ isAdmin: true });
    expect(await gateway.watch(admin, { sessionId: 's1' })).toEqual({ ok: true });
    expect(admin.join).toHaveBeenCalledWith('session:s1');
    expect(await gateway.watch(admin, { sessionId: 'nope' })).toEqual({
      ok: false,
      error: 'Game not found',
    });
  });

  it('updates the session when someone disconnects', async () => {
    await gateway.handleDisconnect(fakeSocket({ sessionId: 's1' }));
    await gateway.handleDisconnect(fakeSocket());
    expect(realtime.broadcastSession).toHaveBeenCalledTimes(1);
  });
});

describe('toAck', () => {
  it('wraps results and friendly errors', async () => {
    expect(await toAck(async () => 5)).toEqual({ ok: true, data: 5 });
    expect(await toAck(async () => Promise.reject(new ConflictException('Nope')))).toEqual({
      ok: false,
      error: 'Nope',
    });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await toAck(async () => Promise.reject(new Error('db down')))).toEqual({
      ok: false,
      error: 'Something went wrong, please try again',
    });
    spy.mockRestore();
  });
});
