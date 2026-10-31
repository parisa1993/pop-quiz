import { Route } from '@angular/router';
import { adminGuard, playerGuard } from './core/guards';
import { routes } from './app.routes';

const find = (path: string, list: Route[] = routes): Route | undefined =>
  list.find((r) => r.path === path);

describe('routes', () => {
  it('guards gamer and admin pages', () => {
    expect(find('play')?.canActivate).toEqual([playerGuard]);
    expect(find('play/:sessionId')?.canActivate).toEqual([playerGuard]);
    expect(find('admin')?.canActivate).toEqual([adminGuard]);
    expect(find('admin/host/:sessionId')?.canActivate).toEqual([adminGuard]);
    expect(find('play/name')?.canActivate).toBeUndefined();
  });

  it('lazy-loads every page', async () => {
    const all = [...routes, ...(find('admin')?.children ?? [])].filter((r) => r.loadComponent);
    expect(all.length).toBeGreaterThanOrEqual(10);
    for (const route of all) expect(await route.loadComponent!()).toBeTruthy();
  });

  it('sends unknown URLs home', () => {
    expect(find('**')?.redirectTo).toBe('');
  });
});
