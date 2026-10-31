import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ApiMock, createApiMock, provideApiMock } from '../../testing/test-helpers';
import { PlayerSessionService } from './player-session.service';
import { STORAGE_KEYS } from './storage';

describe('PlayerSessionService', () => {
  let api: ApiMock;

  function setup() {
    api = createApiMock({
      createPlayer: vi.fn().mockResolvedValue({ id: 'p1', username: 'Ana' }),
      getPlayer: vi.fn().mockResolvedValue({ id: 'p1', username: 'Ana' }),
      joinGame: vi.fn().mockResolvedValue('s1'),
    });
    TestBed.configureTestingModule({ providers: [provideApiMock(api)] });
    return TestBed.inject(PlayerSessionService);
  }

  beforeEach(() => localStorage.clear());

  it('registers and remembers the player', async () => {
    const players = setup();
    await players.register('Ana');
    expect(players.player()).toEqual({ id: 'p1', username: 'Ana' });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.player)!)).toEqual({
      id: 'p1',
      username: 'Ana',
    });
  });

  it('auto-logs in from localStorage, including the current game', () => {
    localStorage.setItem(STORAGE_KEYS.player, JSON.stringify({ id: 'p1', username: 'Ana' }));
    localStorage.setItem(STORAGE_KEYS.sessionId, JSON.stringify('s9'));
    const players = setup();
    expect(players.player()?.username).toBe('Ana');
    expect(players.sessionId()).toBe('s9');
  });

  it('joins a game and remembers the session', async () => {
    const players = setup();
    await expect(players.join('z')).rejects.toThrow('Pick a name first');
    await players.register('Ana');
    expect(await players.join('z')).toBe('s1');
    expect(api.joinGame).toHaveBeenCalledWith('z', 'p1');
    expect(players.sessionId()).toBe('s1');
  });

  it('verifies the stored player and forgets unknown ones', async () => {
    const players = setup();
    expect(await players.verify()).toBe(false);
    await players.register('Ana');
    expect(await players.verify()).toBe(true);

    api.getPlayer.mockRejectedValue(new HttpErrorResponse({ status: 0 }));
    expect(await players.verify()).toBe(true);
    expect(players.player()).not.toBeNull();

    api.getPlayer.mockRejectedValue(new HttpErrorResponse({ status: 404 }));
    expect(await players.verify()).toBe(false);
    expect(players.player()).toBeNull();
  });
});
