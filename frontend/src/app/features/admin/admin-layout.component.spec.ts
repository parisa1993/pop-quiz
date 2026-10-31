import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { createApiMock, provideApiMock } from '../../../testing/test-helpers';
import { AdminAuthService } from '../../core/admin-auth.service';
import { AdminLayoutComponent } from './admin-layout.component';

describe('AdminLayoutComponent', () => {
  it('shows the admin bar and logs out', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideApiMock(createApiMock())] });
    const auth = TestBed.inject(AdminAuthService);
    auth.token.set('jwt');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(AdminLayoutComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Admin');
    (el.querySelector('.link-btn') as HTMLButtonElement).click();
    expect(auth.isLoggedIn()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/']);
  });
});
