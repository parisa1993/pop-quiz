import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { QuizSummary, ServerEvents } from '@pop-quiz/shared';
import { AdminAuthService } from '../../../core/admin-auth.service';
import { ApiService } from '../../../core/api.service';
import { errorMessage } from '../../../core/error-message';
import { SocketService } from '../../../core/socket.service';
import { ToastService } from '../../../core/toast.service';
import { ConfirmButtonComponent } from '../../../shared/confirm-button.component';

@Component({
  selector: 'app-quiz-list-page',
  imports: [RouterLink, ConfirmButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quiz-list.page.html',
  styleUrl: './quiz-list.page.scss',
})
export class QuizListPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly socket = inject(SocketService);
  private readonly auth = inject(AdminAuthService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly quizzes = signal<QuizSummary[] | null>(null);
  protected readonly busyId = signal<string | null>(null);

  ngOnInit(): void {
    void this.load();
    // Player counts and live badges refresh by themselves.
    this.socket.connect(this.auth.token() ?? undefined);
    this.socket
      .on(ServerEvents.GamesChanged)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.load());
  }

  protected async load(): Promise<void> {
    try {
      this.quizzes.set(await this.api.listQuizzes());
    } catch (error) {
      this.toast.error(errorMessage(error));
      this.quizzes.update((q) => q ?? []);
    }
  }

  protected async toggle(quiz: QuizSummary): Promise<void> {
    if (!quiz.enabled && quiz.questionCount === 0) {
      this.toast.error('Add at least one question before enabling this quiz');
      return;
    }
    this.busyId.set(quiz.id);
    try {
      const updated = await this.api.updateQuiz(quiz.id, { enabled: !quiz.enabled });
      this.quizzes.update(
        (list) =>
          list?.map((q) => (q.id === quiz.id ? { ...q, enabled: updated.enabled } : q)) ?? null,
      );
      this.toast.success(
        updated.enabled ? `"${quiz.title}" is now visible to players` : `"${quiz.title}" is hidden`,
      );
    } catch (error) {
      this.toast.error(errorMessage(error));
    } finally {
      this.busyId.set(null);
    }
  }

  protected async host(quiz: QuizSummary): Promise<void> {
    this.busyId.set(quiz.id);
    try {
      if (!quiz.enabled) await this.api.updateQuiz(quiz.id, { enabled: true });
      const session = await this.api.openSession(quiz.id);
      await this.router.navigate(['/admin/host', session.id]);
    } catch (error) {
      this.toast.error(errorMessage(error));
    } finally {
      this.busyId.set(null);
    }
  }

  protected async remove(quiz: QuizSummary): Promise<void> {
    try {
      await this.api.deleteQuiz(quiz.id);
      this.quizzes.update((list) => list?.filter((q) => q.id !== quiz.id) ?? null);
      this.toast.success(`Deleted "${quiz.title}"`);
    } catch (error) {
      this.toast.error(errorMessage(error));
    }
  }
}
