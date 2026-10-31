import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AdminAuthService } from './admin-auth.service';

/** Adds the admin token to admin calls and sends the admin back to login when it expires. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const isAdminCall = req.url.startsWith('/api/admin') && !req.url.endsWith('/admin/login');
  if (!isAdminCall) return next(req);

  const auth = inject(AdminAuthService);
  const router = inject(Router);
  const token = auth.token();
  const authed = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authed).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        auth.logout();
        void router.navigate(['/admin/login']);
      }
      return throwError(() => error);
    }),
  );
};
