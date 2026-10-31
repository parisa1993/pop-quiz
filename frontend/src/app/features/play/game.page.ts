import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  OnInit,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { AnswerPayload, ClientEvents, PlayerGameState, ServerEvents } from '@pop-quiz/shared';
import { NotifyService } from '../../core/notify.service';
import { PlayerSessionService } from '../../core/player-session.service';
import { SocketService } from '../../core/socket.service';
import { ToastService } from '../../core/toast.service';
import { rankLabel } from '../../shared/answer-style';
import { PodiumComponent } from '../../shared/podium.component';
import { ChoiceAnswerComponent } from './answers/choice-answer.component';
import { FreeAnswerComponent } from './answers/free-answer.component';
import { OrderingAnswerComponent } from './answers/ordering-answer.component';

@Component({
  selector: 'app-game-page',
  imports: [ChoiceAnswerComponent, OrderingAnswerComponent, FreeAnswerComponent, PodiumComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './game.page.html',
  styleUrl: './game.page.scss',
})
export class GamePage implements OnInit {
  private readonly socket = inject(SocketService);
  private readonly players = inject(PlayerSessionService);
  private readonly notify = inject(NotifyService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** From the route: /play/:sessionId */
  readonly sessionId = input.required<string>();

  protected readonly state = signal<PlayerGameState | null>(null);
  protected readonly sending = signal(false);
  protected readonly connected = this.socket.connected;
  protected readonly me = this.players.player;
  protected readonly rankLabel = rankLabel;

  protected readonly progress = computed(() => {
    const s = this.state();
    return s && s.totalQuestions ? ((s.currentIndex + 1) / s.totalQuestions) * 100 : 0;
  });
  protected readonly answerKind = computed(() => {
    switch (this.state()?.question?.type) {
      case 'ORDERING':
        return 'ordering';
      case 'TYPE_ANSWER':
      case 'NUMBER_GUESS':
        return 'free';
      default:
        return 'choice';
    }
  });

  constructor() {
    // (Re)join whenever the socket (re)connects, e.g. after the phone wakes up.
    effect(() => {
      if (this.socket.connected()) untracked(() => void this.join());
    });
  }

  ngOnInit(): void {
    this.players.setSession(this.sessionId());
    this.socket.connect();
    this.socket
      .on<PlayerGameState>(ServerEvents.GameState)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((next) => this.onState(next));
  }

  protected async submit(payload: AnswerPayload): Promise<void> {
    const s = this.state();
    if (!s?.question || this.sending()) return;
    this.sending.set(true);
    const ack = await this.socket.emit(ClientEvents.PlayerAnswer, {
      sessionId: s.sessionId,
      questionId: s.question.id,
      payload,
    });
    this.sending.set(false);
    if (!ack.ok) this.toast.error(ack.error);
    else navigator.vibrate?.(30);
  }

  protected backToGames(): void {
    this.players.setSession(null);
    void this.router.navigate(['/play']);
  }

  private async join(): Promise<void> {
    const player = this.players.player();
    if (!player) return;
    const ack = await this.socket.emit(ClientEvents.PlayerJoin, { sessionId: this.sessionId(), playerId: player.id });
    if (!ack.ok && this.socket.connected()) {
      this.toast.error(ack.error);
      this.backToGames();
    }
  }

  /** Applies a new snapshot and plays the matching sound/vibration/confetti. */
  private onState(next: PlayerGameState): void {
    const prev = this.state();
    this.state.set(next);
    if (!prev) return;

    if (prev.status === 'LOBBY' && next.status === 'IN_PROGRESS') {
      this.notify.cue('start');
      this.toast.party("Let's go! The game has started");
    } else if (next.status === 'IN_PROGRESS' && prev.currentIndex !== next.currentIndex) {
      this.notify.cue('question');
    }

    if (!prev.revealed && next.revealed && next.question?.type !== 'POLL') {
      if (next.myResult?.isCorrect) {
        this.notify.cue('correct');
        this.notify.celebrate();
      } else {
        this.notify.cue('wrong');
      }
    }

    if (prev.status !== 'FINISHED' && next.status === 'FINISHED') {
      this.notify.cue('finish');
      this.notify.celebrate((next.final?.rank ?? 99) <= 3);
    }
  }
}
