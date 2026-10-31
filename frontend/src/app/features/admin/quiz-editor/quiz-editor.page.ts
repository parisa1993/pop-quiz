import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Question, QuestionInput, QUESTION_TYPE_INFO, QuizDetail, QuizInput } from '@pop-quiz/shared';
import { ApiService } from '../../../core/api.service';
import { errorMessage } from '../../../core/error-message';
import { ToastService } from '../../../core/toast.service';
import { ConfirmButtonComponent } from '../../../shared/confirm-button.component';
import { ImageUploadComponent } from '../../../shared/image-upload.component';
import { QuestionEditorComponent } from './question-editor.component';

@Component({
  selector: 'app-quiz-editor-page',
  imports: [RouterLink, CdkDropList, CdkDrag, CdkDragHandle, ImageUploadComponent, ConfirmButtonComponent, QuestionEditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quiz-editor.page.html',
  styleUrl: './quiz-editor.page.scss',
})
export class QuizEditorPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  /** From the route; missing on /admin/quizzes/new. */
  readonly id = input<string>();

  protected readonly info = QUESTION_TYPE_INFO;
  protected readonly quiz = signal<QuizDetail | null>(null);
  protected readonly loading = signal(false);
  protected readonly details = signal<QuizInput>({ title: '', description: '', coverImageUrl: null });
  protected readonly savingDetails = signal(false);
  /** The question open in the editor panel: a question, 'new', or nothing. */
  protected readonly editing = signal<Question | 'new' | null>(null);
  protected readonly savingQuestion = signal(false);

  protected readonly isNew = computed(() => !this.id());
  protected readonly questions = computed(() => this.quiz()?.questions ?? []);
  protected readonly locked = computed(() => this.quiz()?.activeSession?.status === 'IN_PROGRESS');
  protected readonly detailsDirty = computed(() => {
    const q = this.quiz();
    const d = this.details();
    return !q || q.title !== d.title || (q.description ?? '') !== (d.description ?? '') || q.coverImageUrl !== d.coverImageUrl;
  });
  protected readonly editingQuestion = computed(() => {
    const e = this.editing();
    return e === 'new' ? null : e;
  });

  ngOnInit(): void {
    if (this.id()) void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    try {
      const quiz = await this.api.getQuiz(this.id()!);
      this.quiz.set(quiz);
      this.details.set({ title: quiz.title, description: quiz.description ?? '', coverImageUrl: quiz.coverImageUrl });
    } catch (error) {
      this.toast.error(errorMessage(error));
      void this.router.navigate(['/admin/quizzes']);
    } finally {
      this.loading.set(false);
    }
  }

  protected patchDetails(changes: Partial<QuizInput>): void {
    this.details.update((d) => ({ ...d, ...changes }));
  }

  protected async saveDetails(event?: Event): Promise<void> {
    event?.preventDefault();
    if (!this.details().title.trim()) {
      this.toast.error('Give the quiz a title');
      return;
    }
    this.savingDetails.set(true);
    try {
      if (this.isNew()) {
        const created = await this.api.createQuiz(this.details());
        this.toast.success('Quiz created! Now add some questions');
        await this.router.navigate(['/admin/quizzes', created.id], { replaceUrl: true });
      } else {
        const updated = await this.api.updateQuiz(this.id()!, this.details());
        this.quiz.update((q) => (q ? { ...q, ...updated, questions: q.questions } : q));
        this.toast.success('Saved');
      }
    } catch (error) {
      this.toast.error(errorMessage(error));
    } finally {
      this.savingDetails.set(false);
    }
  }

  protected async toggleEnabled(): Promise<void> {
    const quiz = this.quiz();
    if (!quiz) return;
    if (!quiz.enabled && quiz.questions.length === 0) {
      this.toast.error('Add at least one question first');
      return;
    }
    try {
      const updated = await this.api.updateQuiz(quiz.id, { enabled: !quiz.enabled });
      this.quiz.update((q) => (q ? { ...q, enabled: updated.enabled } : q));
    } catch (error) {
      this.toast.error(errorMessage(error));
    }
  }

  protected async saveQuestion(input: QuestionInput): Promise<void> {
    const quiz = this.quiz();
    const editing = this.editing();
    if (!quiz || !editing) return;
    this.savingQuestion.set(true);
    try {
      if (editing === 'new') {
        const created = await this.api.createQuestion(quiz.id, input);
        this.setQuestions([...quiz.questions, created]);
        this.toast.success('Question added');
      } else {
        const updated = await this.api.updateQuestion(editing.id, input);
        this.setQuestions(quiz.questions.map((q) => (q.id === updated.id ? updated : q)));
        this.toast.success('Question saved');
      }
      this.editing.set(null);
    } catch (error) {
      this.toast.error(errorMessage(error));
    } finally {
      this.savingQuestion.set(false);
    }
  }

  protected async duplicate(question: Question): Promise<void> {
    const quiz = this.quiz();
    if (!quiz) return;
    try {
      const { type, text, imageUrl, points, config } = question;
      const copy = await this.api.createQuestion(quiz.id, { type, text: `${text} (copy)`.slice(0, 500), imageUrl, points, config } as QuestionInput);
      this.setQuestions([...quiz.questions, copy]);
      this.toast.success('Question duplicated');
    } catch (error) {
      this.toast.error(errorMessage(error));
    }
  }

  protected async remove(question: Question): Promise<void> {
    const quiz = this.quiz();
    if (!quiz) return;
    try {
      await this.api.deleteQuestion(question.id);
      this.setQuestions(quiz.questions.filter((q) => q.id !== question.id).map((q, order) => ({ ...q, order })));
    } catch (error) {
      this.toast.error(errorMessage(error));
    }
  }

  /** Drag & drop: update instantly, save in the background, roll back if it fails. */
  protected async drop(event: CdkDragDrop<Question[]>): Promise<void> {
    const quiz = this.quiz();
    if (!quiz || event.previousIndex === event.currentIndex) return;
    const before = quiz.questions;
    const after = [...before];
    moveItemInArray(after, event.previousIndex, event.currentIndex);
    this.setQuestions(after.map((q, order) => ({ ...q, order })));
    try {
      this.setQuestions(await this.api.reorderQuestions(quiz.id, after.map((q) => q.id)));
    } catch (error) {
      this.setQuestions(before);
      this.toast.error(errorMessage(error));
    }
  }

  protected async host(): Promise<void> {
    const quiz = this.quiz();
    if (!quiz) return;
    try {
      if (!quiz.enabled) await this.api.updateQuiz(quiz.id, { enabled: true });
      const session = await this.api.openSession(quiz.id);
      await this.router.navigate(['/admin/host', session.id]);
    } catch (error) {
      this.toast.error(errorMessage(error));
    }
  }

  private setQuestions(questions: Question[]): void {
    this.quiz.update((q) => (q ? { ...q, questions, questionCount: questions.length } : q));
  }
}
