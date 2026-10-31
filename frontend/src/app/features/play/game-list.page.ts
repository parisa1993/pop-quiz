import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { GameListItem, ServerEvents } from '@pop-quiz/shared';
import { errorMessage } from '../../core/error-message';
import { PlayerSessionService } from '../../core/player-session.service';
import { SocketService } from '../../core/socket.service';
import { ToastService } from '../../core/toast.service';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-game-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './game-list.page.html',
  styleUrl: './game-list.page.scss',
})
export class GameListPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly socket = inject(SocketService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly players = inject(PlayerSessionService);

  protected readonly games = signal<GameListItem[] | null>(null);
  protected readonly joining = signal<string | null>(null);

  ngOnInit(): void {
    void this.players.verify().then((ok) => {
      if (!ok && !this.players.player())
        void this.router.navigate(['/play/name'], { replaceUrl: true });
    });
    void this.load();
    this.socket.connect();
    // The list updates live whenever the host enables a quiz or starts a game.
    this.socket
      .on(ServerEvents.GamesChanged)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.load());
  }

  protected async load(): Promise<void> {
    try {
      this.games.set(await this.api.listGames());
    } catch (error) {
      this.toast.error(errorMessage(error));
      this.games.update((g) => g ?? []);
    }
  }

  protected async join(game: GameListItem): Promise<void> {
    this.joining.set(game.quizId);
    try {
      const sessionId = await this.players.join(game.quizId);
      await this.router.navigate(['/play', sessionId]);
    } catch (error) {
      this.toast.error(errorMessage(error));
      void this.load();
    } finally {
      this.joining.set(null);
    }
  }

  protected changeName(): void {
    this.players.forget();
    void this.router.navigate(['/play/name']);
  }
}
