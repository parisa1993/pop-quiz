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
import { Router, RouterLink } from '@angular/router';
import { ClientEvents, HostGameState, QUESTION_TYPE_INFO, ServerEvents } from '@pop-quiz/shared';
import { AdminAuthService } from '../../../core/admin-auth.service';
import { NotifyService } from '../../../core/notify.service';
import { SocketService } from '../../../core/socket.service';
import { ToastService } from '../../../core/toast.service';
import { answerStyle, rankLabel } from '../../../shared/answer-style';
import { ConfirmButtonComponent } from '../../../shared/confirm-button.component';
import { PodiumComponent } from '../../../shared/podium.component';

type HostAction = 'start' | 'next' | 'prev' | 'reveal' | 'finish';

const EVENTS: Record<HostAction, string> = {
  start: ClientEvents.AdminStart,
  next: ClientEvents.AdminNext,
  prev: ClientEvents.AdminPrev,
  reveal: ClientEvents.AdminReveal,
  finish: ClientEvents.AdminFinish,
};

/** The big screen the host drives the game from: lobby, live question, answers, podium. */
@Component({
  selector: 'app-host-page',
  imports: [RouterLink, PodiumComponent, ConfirmButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './host.page.html',
  styleUrl: './host.page.scss',
})
export class HostPage implements OnInit {
  private readonly socket = inject(SocketService);
  private readonly auth = inject(AdminAuthService);
  private readonly toast = inject(ToastService);
  private readonly notify = inject(NotifyService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly sessionId = input.required<string>();

  protected readonly state = signal<HostGameState | null>(null);
  protected readonly busy = signal(false);
  protected readonly connected = this.socket.connected;
  protected readonly info = QUESTION_TYPE_INFO;
  protected readonly style = answerStyle;
  protected readonly rankLabel = rankLabel;
  protected readonly joinUrl = `${location.origin}`;

  protected readonly onlineCount = computed(() => this.state()?.players.filter((p) => p.connected).length ?? 0);
  protected readonly maxBucket = computed(() => Math.max(1, ...(this.state()?.distribution.map((b) => b.count) ?? [])));
  protected readonly isLast = computed(() => {
    const s = this.state();
    return !!s && s.currentIndex >= s.totalQuestions - 1;
  });

  constructor() {
    effect(() => {
      if (this.socket.connected()) untracked(() => void this.watch());
    });
  }

  ngOnInit(): void {
    this.socket.connect(this.auth.token() ?? undefined);
    this.socket
      .on<HostGameState>(ServerEvents.HostState)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((next) => {
        const prev = this.state();
        this.state.set(next);
        if (prev && prev.status !== 'FINISHED' && next.status === 'FINISHED') this.notify.celebrate(true);
      });
  }

  protected async act(action: HostAction): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    const ack = await this.socket.emit(EVENTS[action], { sessionId: this.sessionId() });
    this.busy.set(false);
    if (!ack.ok) this.toast.error(ack.error);
  }

  private async watch(): Promise<void> {
    const ack = await this.socket.emit(ClientEvents.AdminWatch, { sessionId: this.sessionId() });
    if (!ack.ok && this.socket.connected()) {
      this.toast.error(ack.error);
      void this.router.navigate(['/admin/quizzes']);
    }
  }
}
