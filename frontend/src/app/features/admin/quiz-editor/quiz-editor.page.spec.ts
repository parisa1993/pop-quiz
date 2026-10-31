import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { Question } from '@pop-quiz/shared';
import {
  ApiMock,
  choiceQuestion,
  createApiMock,
  flush,
  provideApiMock,
  quizDetail,
  trueFalseQuestion,
} from '../../../../testing/test-helpers';
import { ToastService } from '../../../core/toast.service';
import { QuizEditorPage } from './quiz-editor.page';

describe('QuizEditorPage', () => {
  let api: ApiMock;
  let fixture: ComponentFixture<QuizEditorPage>;
  let el: HTMLElement;
  let navigate: ReturnType<typeof vi.spyOn>;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  async function setup(id?: string, detail = quizDetail()) {
    api = createApiMock({
      getQuiz: vi.fn().mockResolvedValue(detail),
      createQuiz: vi.fn().mockResolvedValue({ ...detail, id: 'new1' }),
      updateQuiz: vi.fn(async (_id: string, body: object) => ({ ...detail, ...body })),
      reorderQuestions: vi.fn(async (_id: string, ids: string[]) =>
        ids.map((qid, order) => ({ ...detail.questions.find((q) => q.id === qid)!, order })),
      ),
      createQuestion: vi.fn(async (_id: string, input: object) => ({
        ...trueFalseQuestion,
        ...input,
        id: 'q9',
        order: 2,
      })),
      updateQuestion: vi.fn(async (qid: string, input: object) => ({
        ...trueFalseQuestion,
        ...input,
        id: qid,
      })),
      openSession: vi.fn().mockResolvedValue({ id: 's1' }),
    });
    toast = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideApiMock(api),
        { provide: ToastService, useValue: toast },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(QuizEditorPage);
    if (id) fixture.componentRef.setInput('id', id);
    await fixture.whenStable();
    await flush();
    await fixture.whenStable();
    el = fixture.nativeElement as HTMLElement;
  }

  const page = () =>
    fixture.componentInstance as unknown as {
      drop(e: Partial<CdkDragDrop<Question[]>>): Promise<void>;
      saveQuestion(input: object): Promise<void>;
      editing: { set(v: unknown): void; (): unknown };
    };

  it('creates a new quiz and moves on to adding questions', async () => {
    await setup();
    expect(el.textContent).toContain('New quiz');
    const title = el.querySelector('.details input') as HTMLInputElement;
    title.value = 'Party time';
    title.dispatchEvent(new Event('input'));
    el.querySelector('form.details')!.dispatchEvent(new Event('submit'));
    await flush();
    expect(api.createQuiz).toHaveBeenCalledWith(expect.objectContaining({ title: 'Party time' }));
    expect(navigate).toHaveBeenCalledWith(['/admin/quizzes', 'new1'], { replaceUrl: true });
  });

  it('requires a title', async () => {
    await setup();
    el.querySelector('form.details')!.dispatchEvent(new Event('submit'));
    await flush();
    expect(api.createQuiz).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Give the quiz a title');
  });

  it('loads an existing quiz with its questions in order', async () => {
    await setup('z1');
    expect(api.getQuiz).toHaveBeenCalledWith('z1');
    const texts = [...el.querySelectorAll('.qitem__text')].map((n) => n.textContent);
    expect(texts).toEqual(['Cake is great', 'Favourite colour?']);
  });

  it('reorders questions by drag and drop and saves the order', async () => {
    await setup('z1');
    await page().drop({ previousIndex: 1, currentIndex: 0 });
    await fixture.whenStable();
    expect(api.reorderQuestions).toHaveBeenCalledWith('z1', ['q2', 'q1']);
    const texts = [...el.querySelectorAll('.qitem__text')].map((n) => n.textContent);
    expect(texts).toEqual(['Favourite colour?', 'Cake is great']);
  });

  it('rolls back the order if saving fails', async () => {
    await setup('z1');
    api.reorderQuestions.mockRejectedValue(new Error('Locked'));
    await page().drop({ previousIndex: 1, currentIndex: 0 });
    await fixture.whenStable();
    const texts = [...el.querySelectorAll('.qitem__text')].map((n) => n.textContent);
    expect(texts).toEqual(['Cake is great', 'Favourite colour?']);
    expect(toast.error).toHaveBeenCalledWith('Locked');
  });

  it('opens the question editor to add and edit questions', async () => {
    await setup('z1');
    (el.querySelector('.questions__head .btn--yellow') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(el.querySelector('[role=dialog]')?.textContent).toContain('New question');

    await page().saveQuestion({
      type: 'TRUE_FALSE',
      text: 'New one',
      points: 100,
      config: { correct: true },
    });
    await fixture.whenStable();
    expect(api.createQuestion).toHaveBeenCalled();
    expect(el.querySelectorAll('.qitem')).toHaveLength(3);
    expect(el.querySelector('[role=dialog]')).toBeNull();

    page().editing.set(choiceQuestion);
    await fixture.whenStable();
    await page().saveQuestion({ ...choiceQuestion, text: 'Changed' });
    expect(api.updateQuestion).toHaveBeenCalledWith(
      'q2',
      expect.objectContaining({ text: 'Changed' }),
    );
  });

  it('duplicates and deletes questions', async () => {
    await setup('z1');
    (el.querySelector('[aria-label="Duplicate question"]') as HTMLButtonElement).click();
    await flush();
    expect(api.createQuestion).toHaveBeenCalledWith(
      'z1',
      expect.objectContaining({ text: 'Cake is great (copy)' }),
    );

    (el.querySelector('.qitem app-confirm-button button') as HTMLButtonElement).click();
    await fixture.whenStable();
    (el.querySelector('.qitem app-confirm-button .btn--danger') as HTMLButtonElement).click();
    await flush();
    expect(api.deleteQuestion).toHaveBeenCalledWith('q1');
  });

  it('locks editing while the quiz is being played', async () => {
    await setup(
      'z1',
      quizDetail({ activeSession: { id: 's1', status: 'IN_PROGRESS', playerCount: 2 } }),
    );
    expect(el.textContent).toContain('being played right now');
    expect((el.querySelector('.questions__head .btn--yellow') as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('hosts the quiz', async () => {
    await setup('z1', quizDetail({ enabled: false }));
    (el.querySelector('.details .btn--pink') as HTMLButtonElement).click();
    await flush();
    expect(api.updateQuiz).toHaveBeenCalledWith('z1', { enabled: true });
    expect(navigate).toHaveBeenCalledWith(['/admin/host', 's1']);
  });
});
