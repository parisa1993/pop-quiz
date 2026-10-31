import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AdminAuthService } from '../../core/admin-auth.service';
import { errorMessage } from '../../core/error-message';

@Component({
  selector: 'app-admin-login-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="center-screen">
      <form class="card login pop-in" [class.shake]="shake()" (submit)="submit($event)">
        <span class="login__icon" aria-hidden="true">🔐</span>
        <h1>Admin login</h1>
        <p class="muted">Enter the host password to manage quizzes.</p>
        <label class="visually-hidden" for="password">Password</label>
        <input
          id="password"
          class="input input--xl login__pin"
          type="password"
          inputmode="numeric"
          autocomplete="current-password"
          placeholder="••••"
          [value]="password()"
          (input)="password.set($any($event.target).value); error.set(null)"
          autofocus
        />
        @if (error(); as message) {
          <p class="login__error" role="alert">{{ message }}</p>
        }
        <button class="btn btn--lg btn--block" [disabled]="busy() || !password()">
          {{ busy() ? 'Checking…' : 'Log in' }}
        </button>
        <a routerLink="/" class="link-btn login__back">← Back to start</a>
      </form>
    </main>
  `,
  styles: `
    .login { width: min(100%, 400px); text-align: center; }
    .login__icon { font-size: 3rem; display: block; }
    .login__pin { letter-spacing: 0.5em; margin-bottom: var(--space-4); }
    .login__error { color: var(--c-danger); font-weight: 700; }
    .login__back { display: inline-block; margin-top: var(--space-3); color: var(--c-ink-soft); }
    .shake { animation: shake 400ms; }
    @keyframes shake {
      20%, 60% { transform: translateX(-8px); }
      40%, 80% { transform: translateX(8px); }
    }
  `,
})
export class AdminLoginPage implements OnInit {
  private readonly auth = inject(AdminAuthService);
  private readonly router = inject(Router);
  protected readonly password = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly shake = signal(false);

  ngOnInit(): void {
    if (this.auth.isLoggedIn()) void this.router.navigate(['/admin/quizzes'], { replaceUrl: true });
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.busy.set(true);
    try {
      await this.auth.login(this.password());
      await this.router.navigate(['/admin/quizzes'], { replaceUrl: true });
    } catch (error) {
      this.error.set(errorMessage(error));
      this.shake.set(true);
      setTimeout(() => this.shake.set(false), 400);
    } finally {
      this.busy.set(false);
    }
  }
}
