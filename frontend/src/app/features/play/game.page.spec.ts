import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ClientEvents, PlayerGameState, ServerEvents } from '@pop-quiz/shared';
import {
  createApiMock,
  FakeSocket,
  flush,
  playerState,
  provideApiMock,
  provideFakeSocket,
  publicChoice,
} from '../../../testing/test-helpers';
import { NotifyService } from '../../core/notify.service';
import { PlayerSessionService } from '../../core/player-session.service';
import { ToastService } from '../../core/toast.service';
import { GamePage } from './game.page';

describe('GamePage', () => {
  let socket: FakeSocket;
  let notify: { cue: ReturnType<typeof vi.fn>; celebrate: ReturnType<typeof vi.fn> };
  let toast: { error: ReturnType<typeof vi.fn>; party: ReturnType<typeof vi.fn> };

  async function setup() {
    localStorage.clear();
    socket = new FakeSocket();
    notify = { cue: vi.fn(), celebrate: vi.fn() };
    toast = { error: vi.fn(), party: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideApiMock(createApiMock()),
        provideFakeSocket(socket),
        { provide: NotifyService, useValue: notify },
        { provide: ToastService, useValue: toast },
      ],
    });
    TestBed.inject(PlayerSessionService).player.set({ id: 'p1', username: 'Ana' });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(GamePage);
    fixture.componentRef.setInput('sessionId', 's1');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const push = async (state: Partial<PlayerGameState>) => {
      socket.push(ServerEvents.GameState, playerState(state));
      await fixture.whenStable();
    };
    return { fixture, el, push, navigate };
  }

  it('remembers the game and joins when the socket connects', async () => {
    await setup();
    expect(TestBed.inject(PlayerSessionService).sessionId()).toBe('s1');
    expect(socket.connect).toHaveBeenCalled();
    socket.connected.set(true);
    TestBed.tick();
    await flush();
    expect(socket.emit).toHaveBeenCalledWith(ClientEvents.PlayerJoin, { sessionId: 's1', playerId: 'p1' });
  });

  it('leaves the game if joining fails', async () => {
    const { navigate } = await setup();
    socket.ack = { ok: false, error: 'Pick the game from the list to join' };
    socket.connected.set(true);
    TestBed.tick();
    await flush();
    expect(toast.error).toHaveBeenCalledWith('Pick the game from the list to join');
    expect(navigate).toHaveBeenCalledWith(['/play']);
  });

  it('shows the waiting room in the lobby', async () => {
    const { el, push } = await setup();
    await push({ status: 'LOBBY' });
    expect(el.textContent).toContain("You're in, Ana!");
    expect(el.textContent).toContain('2 players here');
  });

  it('follows the host into a question and submits the answer', async () => {
    const { el, push } = await setup();
    await push({ status: 'LOBBY' });
    await push({ status: 'IN_PROGRESS', question: publicChoice });
    expect(notify.cue).toHaveBeenCalledWith('start');
    expect(el.textContent).toContain('Question 1 / 2');
    expect(el.textContent).toContain('Favourite colour?');

    (el.querySelector('.tile') as HTMLButtonElement).click();
    await flush();
    expect(socket.emit).toHaveBeenCalledWith(ClientEvents.PlayerAnswer, {
      sessionId: 's1',
      questionId: 'q2',
      payload: { optionId: 'a' },
    });

    await push({ status: 'IN_PROGRESS', question: publicChoice, myAnswer: { optionId: 'a' } });
    expect(el.textContent).toContain('Answer locked in');
  });

  it('celebrates a correct reveal and shows the answer', async () => {
    const { el, push } = await setup();
    await push({ status: 'IN_PROGRESS', question: publicChoice, myAnswer: { optionId: 'a' } });
    await push({
      status: 'IN_PROGRESS',
      question: publicChoice,
      myAnswer: { optionId: 'a' },
      revealed: true,
      myResult: { isCorrect: true, points: 200 },
      correctAnswerText: 'Pink',
      myScore: 200,
    });
    expect(el.textContent).toContain('Correct! +200 pts');
    expect(el.textContent).toContain('Pink');
    expect(notify.celebrate).toHaveBeenCalled();
  });

  it('cues a new question when the host moves on', async () => {
    const { push } = await setup();
    await push({ status: 'IN_PROGRESS', question: publicChoice });
    await push({ status: 'IN_PROGRESS', question: { ...publicChoice, id: 'q3' }, currentIndex: 1 });
    expect(notify.cue).toHaveBeenCalledWith('question');
  });

  it('shows the final rank and podium, then goes back to the list', async () => {
    const { el, push, navigate } = await setup();
    await push({ status: 'IN_PROGRESS', question: publicChoice });
    const podium = [{ playerId: 'p1', username: 'Ana', score: 300, rank: 1, correctCount: 3, answeredCount: 3 }];
    await push({ status: 'FINISHED', final: { rank: 1, score: 300, playerCount: 2, podium } });
    expect(el.textContent).toContain('You won!');
    expect(el.textContent).toContain('300 points');
    expect(notify.celebrate).toHaveBeenCalledWith(true);

    (el.querySelector('.final__back') as HTMLButtonElement).click();
    expect(TestBed.inject(PlayerSessionService).sessionId()).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/play']);
  });

  it('shows a reconnecting banner while offline', async () => {
    const { el, push } = await setup();
    await push({ status: 'LOBBY' });
    expect(el.textContent).toContain('Reconnecting');
  });
});
