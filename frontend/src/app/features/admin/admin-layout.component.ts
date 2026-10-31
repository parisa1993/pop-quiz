import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AdminAuthService } from '../../core/admin-auth.service';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="bar">
      <a routerLink="/admin/quizzes" class="bar__brand"
        >🎉 Pop Quiz <span class="badge">Admin</span></a
      >
      <nav class="bar__nav">
        <a
          routerLink="/admin/quizzes"
          routerLinkActive="is-active"
          [routerLinkActiveOptions]="{ exact: true }"
          >Quizzes</a
        >
        <button type="button" class="link-btn" (click)="logout()">Log out</button>
      </nav>
    </header>
    <router-outlet />
  `,
  styles: `
    .bar {
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      padding: calc(var(--space-3) + var(--safe-top)) var(--space-4) var(--space-3);
      background: rgba(34, 9, 79, 0.82);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    .bar__brand {
      font-family: var(--font-display);
      font-size: var(--fs-l);
      font-weight: 700;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
    }
    .bar__nav {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      font-weight: 700;
    }
    .bar__nav a {
      text-decoration: none;
      opacity: 0.8;
    }
    .bar__nav a.is-active {
      opacity: 1;
      text-decoration: underline;
      text-underline-offset: 6px;
    }
  `,
})
export class AdminLayoutComponent {
  private readonly auth = inject(AdminAuthService);
  private readonly router = inject(Router);

  protected logout(): void {
    this.auth.logout();
    void this.router.navigate(['/']);
  }
}
