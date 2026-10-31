import { TestBed } from '@angular/core/testing';
import { createApiMock, provideApiMock } from '../../testing/test-helpers';
import { AdminAuthService } from './admin-auth.service';
import { STORAGE_KEYS } from './storage';

describe('AdminAuthService', () => {
  beforeEach(() => localStorage.clear());

  function setup() {
    const api = createApiMock({ adminLogin: vi.fn().mockResolvedValue('jwt') });
    TestBed.configureTestingModule({ providers: [provideApiMock(api)] });
    return { api, auth: TestBed.inject(AdminAuthService) };
  }

  it('stores the token on login and clears it on logout', async () => {
    const { auth, api } = setup();
    expect(auth.isLoggedIn()).toBe(false);
    await auth.login('9999');
    expect(api.adminLogin).toHaveBeenCalledWith('9999');
    expect(auth.isLoggedIn()).toBe(true);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.adminToken)!)).toBe('jwt');
    auth.logout();
    expect(auth.token()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.adminToken)).toBeNull();
  });

  it('restores a saved token', () => {
    localStorage.setItem(STORAGE_KEYS.adminToken, JSON.stringify('saved'));
    expect(setup().auth.token()).toBe('saved');
  });
});
