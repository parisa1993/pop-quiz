import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { createApiMock, flush, provideApiMock } from '../../../testing/test-helpers';
import { AdminAuthService } from '../../core/admin-auth.service';
import { AdminLoginPage } from './admin-login.page';

describe('AdminLoginPage', () => {
  async function setup(adminLogin = vi.fn().mockResolvedValue('jwt')) {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideApiMock(createApiMock({ adminLogin }))] });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(AdminLoginPage);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const login = async (password: string) => {
      const input = el.querySelector('input') as HTMLInputElement;
      input.value = password;
      input.dispatchEvent(new Event('input'));
      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      await flush();
      await fixture.whenStable();
    };
    return { el, login, navigate };
  }

  it('logs in with the right password', async () => {
    const { login, navigate } = await setup();
    await login('9999');
    expect(TestBed.inject(AdminAuthService).isLoggedIn()).toBe(true);
    expect(navigate).toHaveBeenCalledWith(['/admin/quizzes'], { replaceUrl: true });
  });

  it('shows an error for a wrong password', async () => {
    const wrong = new HttpErrorResponse({ status: 401, error: { message: 'Wrong password' } });
    const { el, login, navigate } = await setup(vi.fn().mockRejectedValue(wrong));
    await login('0000');
    expect(el.querySelector('[role=alert]')?.textContent).toBe('Wrong password');
    expect(navigate).not.toHaveBeenCalled();
  });
});
