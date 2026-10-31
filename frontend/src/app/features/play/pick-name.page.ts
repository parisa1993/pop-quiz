import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { USERNAME_MAX, USERNAME_MIN } from '@pop-quiz/shared';
import { errorMessage } from '../../core/error-message';
import { PlayerSessionService } from '../../core/player-session.service';

const SUGGESTIONS = ['Cake Boss', 'Party Panda', 'Quiz Wizard', 'Confetti Queen', 'Balloon Ninja', 'Candle King'];

@Component({
  selector: 'app-pick-name-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="center-screen">
      <form class="card pick pop-in" (submit)="submit($event)">
        <span class="pick__emoji" aria-hidden="true">🥳</span>
        <h1>What should we call you?</h1>
        <p class="muted">No password needed, just a fun name everyone will see on the leaderboard.</p>

        <label class="visually-hidden" for="username">Your name</label>
        <input
          id="username"
          class="input input--xl"
          [value]="name()"
          (input)="name.set($any($event.target).value); error.set(null)"
          [attr.maxlength]="max"
          autocomplete="nickname"
          autocapitalize="words"
          enterkeyhint="go"
          placeholder="Your name"
          autofocus
        />
        @if (error(); as message) {
          <p class="pick__error" role="alert">{{ message }}</p>
        }

        <div class="pick__ideas" aria-label="Name ideas">
          @for (idea of suggestions; track idea) {
            <button type="button" class="chip chip--light" (click)="name.set(idea); error.set(null)">{{ idea }}</button>
          }
        </div>

        <button class="btn btn--pink btn--lg btn--block" [disabled]="busy() || name().trim().length < min">
          {{ busy() ? 'One sec…' : "Let's go! 🚀" }}
        </button>
        <a routerLink="/" class="link-btn pick__back">← Back</a>
      </form>
    </main>
  `,
  styles: `
    .pick { width: min(100%, 440px); text-align: center; }
    .pick__emoji { font-size: 3.5rem; display: block; }
    .pick__error { color: var(--c-danger); font-weight: 700; margin-top: var(--space-3); }
    .pick__ideas {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: var(--space-2);
      margin: var(--space-4) 0 var(--space-5);
    }
    .pick__ideas .chip { border: 0; cursor: pointer; }
    .pick__back { display: inline-block; margin-top: var(--space-3); color: var(--c-ink-soft); }
  `,
})
export class PickNamePage implements OnInit {
  private readonly players = inject(PlayerSessionService);
  private readonly router = inject(Router);

  protected readonly min = USERNAME_MIN;
  protected readonly max = USERNAME_MAX;
  protected readonly suggestions = SUGGESTIONS;
  protected readonly name = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  ngOnInit(): void {
    if (this.players.player()) void this.router.navigate(['/play'], { replaceUrl: true });
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.players.register(this.name());
      await this.router.navigate(['/play'], { replaceUrl: true });
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
