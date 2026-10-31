import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { QuizSummary, ServerEvents } from '@pop-quiz/shared';
import {
  ApiMock,
  createApiMock,
  FakeSocket,
  flush,
  provideApiMock,
  provideFakeSocket,
  quizSummary,
} from '../../../../testing/test-helpers';
import { ToastService } from '../../../core/toast.service';
import { QuizListPage } from './quiz-list.page';

describe('QuizListPage', () => {
  let api: ApiMock;
  let socket: FakeSocket;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  async function setup(quizzes: QuizSummary[]) {
    api = createApiMock({
      listQuizzes: vi.fn().mockResolvedValue(quizzes),
      updateQuiz: vi.fn(async (_id: string, body: { enabled: boolean }) => ({ ...quizzes[0], ...body })),
      openSession: vi.fn().mockResolvedValue({ id: 's1' }),
    });
    socket = new FakeSocket();
    toast = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideApiMock(api), provideFakeSocket(socket), { provide: ToastService, useValue: toast }],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(QuizListPage);
    await fixture.whenStable();
    await flush();
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement, navigate };
  }

  it('lists quizzes with their stats', async () => {
    const { el } = await setup([quizSummary({ activeSession: { id: 's1', status: 'IN_PROGRESS', playerCount: 2 } })]);
    expect(el.textContent).toContain('Birthday Bash');
    expect(el.textContent).toContain('3 played');
    expect(el.textContent).toContain('Live');
  });

  it('shows an empty state', async () => {
    const { el } = await setup([]);
    expect(el.textContent).toContain('No quizzes yet');
  });

  it('toggles a quiz on and off', async () => {
    const { el, fixture } = await setup([quizSummary({ enabled: true })]);
    (el.querySelector('.switch input') as HTMLInputElement).dispatchEvent(new Event('change'));
    await flush();
    await fixture.whenStable();
    expect(api.updateQuiz).toHaveBeenCalledWith('z1', { enabled: false });
    expect(el.textContent).toContain('Off');
  });

  it('refuses to enable an empty quiz', async () => {
    const { el } = await setup([quizSummary({ enabled: false, questionCount: 0 })]);
    (el.querySelector('.switch input') as HTMLInputElement).dispatchEvent(new Event('change'));
    await flush();
    expect(api.updateQuiz).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it('opens the host screen (enabling the quiz if needed)', async () => {
    const { el, navigate } = await setup([quizSummary({ enabled: false })]);
    (el.querySelector('.btn--pink') as HTMLButtonElement).click();
    await flush();
    expect(api.updateQuiz).toHaveBeenCalledWith('z1', { enabled: true });
    expect(navigate).toHaveBeenCalledWith(['/admin/host', 's1']);
  });

  it('deletes after confirmation', async () => {
    const { el, fixture } = await setup([quizSummary()]);
    (el.querySelector('app-confirm-button button') as HTMLButtonElement).click();
    await fixture.whenStable();
    (el.querySelector('app-confirm-button .btn--danger') as HTMLButtonElement).click();
    await flush();
    await fixture.whenStable();
    expect(api.deleteQuiz).toHaveBeenCalledWith('z1');
    expect(el.textContent).toContain('No quizzes yet');
  });

  it('refreshes live when games change', async () => {
    await setup([quizSummary()]);
    socket.push(ServerEvents.GamesChanged);
    await flush();
    expect(api.listQuizzes).toHaveBeenCalledTimes(2);
  });
});
