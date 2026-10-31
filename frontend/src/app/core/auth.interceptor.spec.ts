import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminAuthService } from './admin-auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let auth: AdminAuthService;
  const router = { navigate: vi.fn() };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: router },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AdminAuthService);
    auth.token.set('jwt');
  });

  it('adds the bearer token to admin calls only', () => {
    void firstValueFrom(http.get('/api/admin/quizzes'));
    void firstValueFrom(http.get('/api/games'));
    void firstValueFrom(http.post('/api/admin/login', {}));
    expect(backend.expectOne('/api/admin/quizzes').request.headers.get('Authorization')).toBe('Bearer jwt');
    expect(backend.expectOne('/api/games').request.headers.has('Authorization')).toBe(false);
    expect(backend.expectOne('/api/admin/login').request.headers.has('Authorization')).toBe(false);
  });

  it('logs out and redirects on 401', async () => {
    const call = firstValueFrom(http.get('/api/admin/quizzes'));
    backend.expectOne('/api/admin/quizzes').flush({}, { status: 401, statusText: 'Unauthorized' });
    await expect(call).rejects.toBeTruthy();
    expect(auth.token()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/admin/login']);
  });
});
