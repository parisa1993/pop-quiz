import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { PlayerSessionService } from '../../core/player-session.service';
import { createApiMock, provideApiMock } from '../../../testing/test-helpers';
import { HomePage } from './home.page';

describe('HomePage', () => {
  async function setup(player: { id: string; username: string } | null, sessionId: string | null) {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideApiMock(createApiMock())] });
    const players = TestBed.inject(PlayerSessionService);
    players.player.set(player);
    players.sessionId.set(sessionId);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(HomePage);
    await fixture.whenStable();
    return { fixture, navigate };
  }

  it('shows both entry buttons to new visitors', async () => {
    const { fixture, navigate } = await setup(null, null);
    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('Play the game');
    expect(text).toContain('Login as admin');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('sends a returning gamer back into their game', async () => {
    const { navigate } = await setup({ id: 'p', username: 'Ana' }, 's1');
    expect(navigate).toHaveBeenCalledWith(['/play', 's1'], { replaceUrl: true });
  });

  it('sends a returning gamer without a game to the list', async () => {
    const { navigate } = await setup({ id: 'p', username: 'Ana' }, null);
    expect(navigate).toHaveBeenCalledWith(['/play'], { replaceUrl: true });
  });
});
