import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { SessionResults, SessionSummary } from '@pop-quiz/shared';
import { ApiMock, createApiMock, flush, provideApiMock } from '../../../../testing/test-helpers';
import { ResultsPage } from './results.page';

const session = (id: string, status: SessionSummary['status'], playerCount = 2): SessionSummary => ({
  id,
  quizId: 'z1',
  status,
  playerCount,
  createdAt: '2026-10-31T10:00:00.000Z',
  startedAt: '2026-10-31T10:05:00.000Z',
  finishedAt: null,
});

const results: SessionResults = {
  session: { ...session('s1', 'FINISHED'), quizTitle: 'Birthday Bash' },
  leaderboard: [
    { playerId: 'p1', username: 'Ana', score: 300, rank: 1, correctCount: 2, answeredCount: 2 },
    { playerId: 'p2', username: 'Ben', score: 0, rank: 2, correctCount: 0, answeredCount: 1 },
  ],
  questions: [
    { id: 'q1', order: 0, text: 'Cat name?', type: 'TYPE_ANSWER', points: 100, correctAnswer: 'Miso' },
    { id: 'q2', order: 1, text: 'Colour?', type: 'SINGLE_CHOICE', points: 200, correctAnswer: 'Pink' },
  ],
  answers: [
    { playerId: 'p1', questionId: 'q1', answerText: 'miso', isCorrect: true, points: 100 },
    { playerId: 'p1', questionId: 'q2', answerText: 'Pink', isCorrect: true, points: 200 },
    { playerId: 'p2', questionId: 'q1', answerText: 'Tom', isCorrect: false, points: 0 },
  ],
};

describe('ResultsPage', () => {
  let api: ApiMock;
  let fixture: ComponentFixture<ResultsPage>;
  let el: HTMLElement;

  async function setup(sessions: SessionSummary[], query?: string) {
    api = createApiMock({
      listSessions: vi.fn().mockResolvedValue(sessions),
      getResults: vi.fn().mockResolvedValue(results),
    });
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideApiMock(api)] });
    fixture = TestBed.createComponent(ResultsPage);
    fixture.componentRef.setInput('id', 'z1');
    if (query) fixture.componentRef.setInput('session', query);
    await fixture.whenStable();
    await flush();
    await fixture.whenStable();
    el = fixture.nativeElement as HTMLElement;
  }

  it('opens the latest finished game and shows the podium and leaderboard', async () => {
    await setup([session('s2', 'IN_PROGRESS'), session('s1', 'FINISHED'), session('s0', 'LOBBY', 0)]);
    expect(api.getResults).toHaveBeenCalledWith('s1');
    expect(el.querySelectorAll('.session')).toHaveLength(2);
    expect(el.querySelector('app-podium')).not.toBeNull();
    expect(el.querySelector('.board__row')?.textContent).toContain('Ana');
    expect(el.querySelector('.board__row')?.textContent).toContain('300 pts');
  });

  it('honours the ?session= query param', async () => {
    await setup([session('s2', 'FINISHED'), session('s1', 'FINISHED')], 's1');
    expect(api.getResults).toHaveBeenCalledWith('s1');
  });

  it('drills into one player’s answers', async () => {
    await setup([session('s1', 'FINISHED')]);
    (el.querySelectorAll('.board__head')[1] as HTMLButtonElement).click();
    await fixture.whenStable();
    const rows = [...el.querySelectorAll('.detail__row')].map((r) => r.textContent);
    expect(rows[0]).toContain('Tom');
    expect(rows[0]).toContain('❌');
    expect(rows[1]).toContain('No answer');
  });

  it('shows per-question stats', async () => {
    await setup([session('s1', 'FINISHED')]);
    (el.querySelectorAll('.tab')[1] as HTMLButtonElement).click();
    await fixture.whenStable();
    const stats = [...el.querySelectorAll('.qstats li')].map((r) => r.textContent);
    expect(stats[0]).toContain('1/2');
    expect(stats[1]).toContain('1/1');
  });

  it('shows an empty state before any game was played', async () => {
    await setup([]);
    expect(el.textContent).toContain('No games played yet');
  });
});
