import { signal } from '@angular/core';
import type {
  Ack,
  HostGameState,
  PlayerGameState,
  PublicQuestion,
  Question,
  QuizDetail,
  QuizSummary,
} from '@pop-quiz/shared';
import { Observable, Subject } from 'rxjs';
import { ApiService } from '../app/core/api.service';
import { SocketService } from '../app/core/socket.service';

/** Stand-in for SocketService: tests push server events and inspect what was emitted. */
export class FakeSocket {
  readonly connected = signal(false);
  ack: Ack<unknown> = { ok: true, data: undefined };
  readonly connect = vi.fn();
  readonly disconnect = vi.fn();
  readonly emit = vi.fn(async (_event: string, _body: unknown) => this.ack);
  private readonly subjects = new Map<string, Subject<unknown>>();

  on<T>(event: string): Observable<T> {
    return this.subject(event).asObservable() as Observable<T>;
  }

  push(event: string, value?: unknown): void {
    this.subject(event).next(value);
  }

  private subject(event: string): Subject<unknown> {
    if (!this.subjects.has(event)) this.subjects.set(event, new Subject());
    return this.subjects.get(event)!;
  }
}

export const provideFakeSocket = (socket: FakeSocket) => ({
  provide: SocketService,
  useValue: socket,
});

export type ApiMock = { [K in keyof ApiService]: ReturnType<typeof vi.fn> };

export function createApiMock(overrides: Partial<ApiMock> = {}): ApiMock {
  const names: (keyof ApiService)[] = [
    'adminLogin',
    'listQuizzes',
    'getQuiz',
    'createQuiz',
    'updateQuiz',
    'deleteQuiz',
    'createQuestion',
    'updateQuestion',
    'deleteQuestion',
    'reorderQuestions',
    'uploadImage',
    'openSession',
    'listSessions',
    'getResults',
    'createPlayer',
    'getPlayer',
    'listGames',
    'joinGame',
  ];
  const mock = Object.fromEntries(
    names.map((n) => [n, vi.fn().mockResolvedValue(undefined)]),
  ) as unknown as ApiMock;
  return Object.assign(mock, overrides);
}

export const provideApiMock = (api: ApiMock) => ({ provide: ApiService, useValue: api });

export const trueFalseQuestion: Question = {
  id: 'q1',
  quizId: 'z1',
  order: 0,
  type: 'TRUE_FALSE',
  text: 'Cake is great',
  imageUrl: null,
  points: 100,
  config: { correct: true },
};

export const choiceQuestion: Question = {
  id: 'q2',
  quizId: 'z1',
  order: 1,
  type: 'SINGLE_CHOICE',
  text: 'Favourite colour?',
  imageUrl: null,
  points: 200,
  config: {
    options: [
      { id: 'a', text: 'Pink' },
      { id: 'b', text: 'Blue' },
    ],
    correctOptionId: 'a',
  },
};

export function quizSummary(overrides: Partial<QuizSummary> = {}): QuizSummary {
  return {
    id: 'z1',
    title: 'Birthday Bash',
    description: 'How well do you know her?',
    coverImageUrl: null,
    enabled: true,
    questionCount: 2,
    playerCount: 3,
    sessionCount: 1,
    activeSession: null,
    createdAt: '2026-10-31T10:00:00.000Z',
    updatedAt: '2026-10-31T10:00:00.000Z',
    ...overrides,
  };
}

export function quizDetail(overrides: Partial<QuizDetail> = {}): QuizDetail {
  return { ...quizSummary(), questions: [trueFalseQuestion, choiceQuestion], ...overrides };
}

export const publicChoice: PublicQuestion = {
  id: 'q2',
  type: 'SINGLE_CHOICE',
  text: 'Favourite colour?',
  imageUrl: null,
  points: 200,
  config: {
    options: [
      { id: 'a', text: 'Pink' },
      { id: 'b', text: 'Blue' },
    ],
  },
};

export function playerState(overrides: Partial<PlayerGameState> = {}): PlayerGameState {
  return {
    sessionId: 's1',
    quizTitle: 'Birthday Bash',
    status: 'LOBBY',
    currentIndex: 0,
    totalQuestions: 2,
    players: [
      { id: 'p1', username: 'Ana', connected: true },
      { id: 'p2', username: 'Ben', connected: true },
    ],
    question: null,
    revealed: false,
    myAnswer: null,
    myResult: null,
    correctAnswerText: null,
    myScore: 0,
    final: null,
    ...overrides,
  };
}

export function hostState(overrides: Partial<HostGameState> = {}): HostGameState {
  return {
    sessionId: 's1',
    quizId: 'z1',
    quizTitle: 'Birthday Bash',
    status: 'LOBBY',
    currentIndex: 0,
    totalQuestions: 2,
    question: null,
    correctAnswerText: null,
    revealed: false,
    players: [{ id: 'p1', username: 'Ana', connected: true, score: 0, answeredCurrent: false }],
    answeredCount: 0,
    distribution: [],
    leaderboard: [],
    ...overrides,
  };
}

/** Lets pending promises (API mocks, async handlers) settle. */
export const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
