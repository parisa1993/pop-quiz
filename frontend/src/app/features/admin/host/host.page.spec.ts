import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ClientEvents, HostGameState, ServerEvents } from '@pop-quiz/shared';
import {
  choiceQuestion,
  createApiMock,
  FakeSocket,
  flush,
  hostState,
  provideApiMock,
  provideFakeSocket,
} from '../../../../testing/test-helpers';
import { AdminAuthService } from '../../../core/admin-auth.service';
import { NotifyService } from '../../../core/notify.service';
import { ToastService } from '../../../core/toast.service';
import { HostPage } from './host.page';

describe('HostPage', () => {
  let socket: FakeSocket;
  let toast: { error: ReturnType<typeof vi.fn> };
  let notify: { celebrate: ReturnType<typeof vi.fn> };

  async function setup() {
    localStorage.clear();
    socket = new FakeSocket();
    toast = { error: vi.fn() };
    notify = { celebrate: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideApiMock(createApiMock()),
        provideFakeSocket(socket),
        { provide: ToastService, useValue: toast },
        { provide: NotifyService, useValue: notify },
      ],
    });
    TestBed.inject(AdminAuthService).token.set('jwt');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(HostPage);
    fixture.componentRef.setInput('sessionId', 's1');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const push = async (state: Partial<HostGameState>) => {
      socket.push(ServerEvents.HostState, hostState(state));
      await fixture.whenStable();
    };
    const click = async (text: string) => {
      const button = [...el.querySelectorAll('button')].find((b) =>
        b.textContent?.includes(text),
      ) as HTMLButtonElement;
      button.click();
      await flush();
      await fixture.whenStable();
    };
    return { fixture, el, push, click, navigate };
  }

  const live = (overrides: Partial<HostGameState> = {}) => ({
    status: 'IN_PROGRESS' as const,
    question: choiceQuestion,
    correctAnswerText: 'Pink',
    answeredCount: 1,
    distribution: [
      { key: 'a', label: 'Pink', count: 1, correct: true },
      { key: 'b', label: 'Blue', count: 0, correct: false },
    ],
    ...overrides,
  });

  it('connects with the admin token and watches the session', async () => {
    await setup();
    expect(socket.connect).toHaveBeenCalledWith('jwt');
    socket.connected.set(true);
    TestBed.tick();
    await flush();
    expect(socket.emit).toHaveBeenCalledWith(ClientEvents.AdminWatch, { sessionId: 's1' });
  });

  it('shows the lobby and starts the game', async () => {
    const { el, push, click } = await setup();
    await push({ status: 'LOBBY' });
    expect(el.querySelector('.lobby__count')?.textContent).toMatch(/1\s*player joined/);
    expect(el.textContent).toContain('Ana');
    await click('Start the game');
    expect(socket.emit).toHaveBeenCalledWith(ClientEvents.AdminStart, { sessionId: 's1' });
  });

  it('shows live progress, keeps the answer private until reveal and moves on', async () => {
    const { el, push, click } = await setup();
    await push(live());
    expect(el.textContent).toContain('Question 1 / 2');
    expect(el.textContent).toContain('1 / 1 answered');
    expect(el.textContent).toContain('only you can see this');
    expect(el.querySelectorAll('.bar')).toHaveLength(2);

    await click('Reveal answer');
    expect(socket.emit).toHaveBeenCalledWith(ClientEvents.AdminReveal, { sessionId: 's1' });
    await push(live({ revealed: true }));
    expect(el.querySelector('.answer')?.textContent).toContain('Pink');

    await click('Next');
    expect(socket.emit).toHaveBeenCalledWith(ClientEvents.AdminNext, { sessionId: 's1' });
    await push(live({ currentIndex: 1 }));
    await click('Back');
    expect(socket.emit).toHaveBeenCalledWith(ClientEvents.AdminPrev, { sessionId: 's1' });
  });

  it('finishes from the last question after confirming', async () => {
    const { el, push, click } = await setup();
    await push(live({ currentIndex: 1 }));
    await click('Finish & show winners');
    expect(el.textContent).toContain('End the game?');
    await click('Finish 🏁');
    expect(socket.emit).toHaveBeenCalledWith(ClientEvents.AdminFinish, { sessionId: 's1' });
  });

  it('shows the winners when the game ends', async () => {
    const { el, push } = await setup();
    await push(live());
    const leaderboard = [
      { playerId: 'p1', username: 'Ana', score: 300, rank: 1, correctCount: 3, answeredCount: 3 },
      { playerId: 'p2', username: 'Ben', score: 100, rank: 2, correctCount: 1, answeredCount: 3 },
    ];
    await push({ status: 'FINISHED', leaderboard });
    expect(el.textContent).toContain('Winners');
    expect(el.querySelectorAll('.board li')).toHaveLength(2);
    expect(notify.celebrate).toHaveBeenCalledWith(true);
  });

  it('reports refused actions', async () => {
    const { push, click } = await setup();
    await push(live());
    socket.ack = { ok: false, error: "The game isn't running" };
    await click('Reveal answer');
    expect(toast.error).toHaveBeenCalledWith("The game isn't running");
  });
});
