import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { createApiMock, provideApiMock } from '../../testing/test-helpers';
import { AdminAuthService } from './admin-auth.service';
import { adminGuard, playerGuard } from './guards';
import { PlayerSessionService } from './player-session.service';

describe('guards', () => {
  const run = (guard: typeof adminGuard) =>
    TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideApiMock(createApiMock())],
    });
  });

  it('adminGuard requires a token', () => {
    expect((run(adminGuard) as UrlTree).toString()).toBe('/admin/login');
    TestBed.inject(AdminAuthService).token.set('jwt');
    expect(run(adminGuard)).toBe(true);
  });

  it('playerGuard requires a picked name', () => {
    expect((run(playerGuard) as UrlTree).toString()).toBe('/play/name');
    TestBed.inject(PlayerSessionService).player.set({ id: 'p', username: 'Ana' });
    expect(run(playerGuard)).toBe(true);
  });
});
