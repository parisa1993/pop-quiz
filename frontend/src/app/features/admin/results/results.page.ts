import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { QUESTION_TYPE_INFO, ResultAnswer, SessionResults, SessionSummary } from '@pop-quiz/shared';
import { ApiService } from '../../../core/api.service';
import { errorMessage } from '../../../core/error-message';
import { ToastService } from '../../../core/toast.service';
import { rankLabel } from '../../../shared/answer-style';
import { PodiumComponent } from '../../../shared/podium.component';

const STATUS_LABEL = { LOBBY: 'Lobby', IN_PROGRESS: 'Live', FINISHED: 'Finished' } as const;

@Component({
  selector: 'app-results-page',
  imports: [RouterLink, DatePipe, PodiumComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './results.page.html',
  styleUrl: './results.page.scss',
})
export class ResultsPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  /** Quiz id from the route. */
  readonly id = input.required<string>();
  /** Optional ?session= query param to open a specific game. */
  readonly session = input<string>();

  protected readonly info = QUESTION_TYPE_INFO;
  protected readonly statusLabel = STATUS_LABEL;
  protected readonly rankLabel = rankLabel;
  protected readonly sessions = signal<SessionSummary[] | null>(null);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly results = signal<SessionResults | null>(null);
  protected readonly expanded = signal<string | null>(null);
  protected readonly tab = signal<'players' | 'questions'>('players');

  /** Answers indexed by player then question, for the drill-down. */
  private readonly answerIndex = computed(() => {
    const map = new Map<string, ResultAnswer>();
    for (const a of this.results()?.answers ?? []) map.set(`${a.playerId}:${a.questionId}`, a);
    return map;
  });

  protected readonly questionStats = computed(() => {
    const r = this.results();
    if (!r) return [];
    return r.questions.map((q) => {
      const answers = r.answers.filter((a) => a.questionId === q.id);
      const correct = answers.filter((a) => a.isCorrect).length;
      return { ...q, answered: answers.length, correct, pct: answers.length ? Math.round((correct / answers.length) * 100) : 0 };
    });
  });

  ngOnInit(): void {
    void this.loadSessions();
  }

  protected answerOf(playerId: string, questionId: string): ResultAnswer | undefined {
    return this.answerIndex().get(`${playerId}:${questionId}`);
  }

  protected toggle(playerId: string): void {
    this.expanded.update((current) => (current === playerId ? null : playerId));
  }

  protected async select(sessionId: string): Promise<void> {
    this.selectedId.set(sessionId);
    this.results.set(null);
    this.expanded.set(null);
    try {
      this.results.set(await this.api.getResults(sessionId));
    } catch (error) {
      this.toast.error(errorMessage(error));
    }
  }

  private async loadSessions(): Promise<void> {
    try {
      const sessions = (await this.api.listSessions(this.id())).filter((s) => s.status !== 'LOBBY' || s.playerCount > 0);
      this.sessions.set(sessions);
      const wanted = sessions.find((s) => s.id === this.session()) ?? sessions.find((s) => s.status === 'FINISHED') ?? sessions[0];
      if (wanted) await this.select(wanted.id);
    } catch (error) {
      this.toast.error(errorMessage(error));
      this.sessions.set([]);
    }
  }
}
