import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AdminAuthService } from './admin-auth.service';
import { PlayerSessionService } from './player-session.service';

export const adminGuard: CanActivateFn = () =>
  inject(AdminAuthService).isLoggedIn() || inject(Router).createUrlTree(['/admin/login']);

export const playerGuard: CanActivateFn = () =>
  !!inject(PlayerSessionService).player() || inject(Router).createUrlTree(['/play/name']);
