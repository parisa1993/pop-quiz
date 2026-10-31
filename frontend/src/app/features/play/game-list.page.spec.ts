import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { GameListItem, ServerEvents } from '@pop-quiz/shared';
import { createApiMock, FakeSocket, flush, provideApiMock, provideFakeSocket } from '../../../testing/test-helpers';
import { PlayerSessionService } from '../../core/player-session.service';
import { GameListPage } from './game-list.page';

const game = (overrides: Partial<GameListItem> = {}): GameListItem => ({
  quizId: 'z1',
  title: 'Birthday Bash',
  description: null,
  coverImageUrl: null,
  questionCount: 5,
  session: null,
  ...overrides,
});

describe('GameListPage', () => {
  async function setup(games: GameListItem[]) {
    localStorage.clear();
    const api = createApiMock({
      listGames: vi.fn().mockResolvedValue(games),
      getPlayer: vi.fn().mockResolvedValue({ id: 'p1', username: 'Ana' }),
      joinGame: vi.fn().mockResolvedValue('s1'),
    });
    const socket = new FakeSocket();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideApiMock(api), provideFakeSocket(socket)] });
    TestBed.inject(PlayerSessionService).player.set({ id: 'p1', username: 'Ana' });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(GameListPage);
    await fixture.whenStable();
    await flush();
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement, api, socket, navigate };
  }

  it('greets the player and lists games with live status', async () => {
    const { el } = await setup([game({ session: { id: 's1', status: 'IN_PROGRESS', playerCount: 4 } })]);
    expect(el.textContent).toContain('Ana');
    expect(el.textContent).toContain('Live now');
    expect(el.textContent).toContain('5 questions');
  });

  it('shows an empty state and refreshes when the server says games changed', async () => {
    const { el, api, socket, fixture } = await setup([]);
    expect(el.textContent).toContain('No games ready yet');
    api.listGames.mockResolvedValue([game()]);
    socket.push(ServerEvents.GamesChanged);
    await flush();
    await fixture.whenStable();
    expect(el.textContent).toContain('Birthday Bash');
  });

  it('joins a game', async () => {
    const { el, api, navigate } = await setup([game()]);
    (el.querySelector('.game') as HTMLButtonElement).click();
    await flush();
    expect(api.joinGame).toHaveBeenCalledWith('z1', 'p1');
    expect(navigate).toHaveBeenCalledWith(['/play', 's1']);
  });

  it('lets the player change their name', async () => {
    const { el, navigate } = await setup([]);
    (el.querySelector('.list-head__change') as HTMLButtonElement).click();
    expect(TestBed.inject(PlayerSessionService).player()).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/play/name']);
  });
});
