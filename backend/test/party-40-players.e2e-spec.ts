import {
  AnswerPayload,
  ClientEvents,
  HostGameState,
  PlayerDto,
  PlayerGameState,
  Question,
  QuestionInput,
  ServerEvents,
} from '@pop-quiz/shared';
import type { Socket } from 'socket.io-client';
import request from 'supertest';
import { connect, emitAck, startServer, StateRecorder, TestServer, TINY_PNG } from './helpers.js';

/**
 * Party-size game: 40 players play a whole quiz with every question type, all answering at
 * the same moment, with reconnects and a late joiner. Checks scores, ranks and results, and
 * that every step reaches all 40 phones quickly.
 */
const PLAYERS = 40;
const STEP_LIMIT_MS = 3000; // every broadcast must reach all phones within this time

interface Bot {
  index: number;
  player: PlayerDto;
  socket: Socket;
  states: StateRecorder<PlayerGameState>;
}

type Answers = { correct: AnswerPayload; wrong: AnswerPayload };

describe('40-player birthday party (e2e)', () => {
  let server: TestServer;
  let token: string;
  let quizId: string;
  let questions: Question[];
  let sessionId: string;
  let adminSocket: Socket;
  let host: StateRecorder<HostGameState>;
  const bots: Bot[] = [];
  const answersByType = new Map<string, Answers>();

  const http = () => request(server.url);
  const admin = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);

  /** Player i answers question q correctly unless (i + q) is divisible by 3. Polls score 0. */
  const answersCorrectly = (i: number, q: number) => (i + q) % 3 !== 0;
  const expectedScore = (i: number, upTo = questions.length) =>
    questions
      .slice(0, upTo)
      .reduce(
        (sum, q, qi) => sum + (q.type !== 'POLL' && answersCorrectly(i, qi) ? q.points : 0),
        0,
      );

  async function joinBot(index: number): Promise<Bot> {
    const player: PlayerDto = (
      await http()
        .post('/api/players')
        .send({ username: `Guest ${String(index + 1).padStart(2, '0')}` })
        .expect(201)
    ).body;
    await http().post(`/api/games/${quizId}/join`).send({ playerId: player.id }).expect(200);
    const socket = await connect(server.url);
    const states = new StateRecorder<PlayerGameState>(socket);
    expect(
      await emitAck(socket, ClientEvents.PlayerJoin, { sessionId, playerId: player.id }),
    ).toEqual({
      ok: true,
    });
    return { index, player, socket, states };
  }

  async function timed<T>(label: string, work: () => Promise<T>): Promise<T> {
    const started = Date.now();
    const result = await work();
    const ms = Date.now() - started;
    expect(ms, `${label} took ${ms}ms`).toBeLessThan(STEP_LIMIT_MS);
    return result;
  }

  beforeAll(async () => {
    server = await startServer();
    token = (await http().post('/api/admin/login').send({ password: '9999' }).expect(200)).body
      .token;

    const quiz = (
      await admin(http().post('/api/admin/quizzes')).send({ title: 'Party of 40' }).expect(201)
    ).body;
    quizId = quiz.id;
    const imageUrl = (
      await admin(http().post('/api/admin/uploads'))
        .attach('file', TINY_PNG, 'photo.png')
        .expect(201)
    ).body.url;

    const inputs: [QuestionInput, Answers][] = [
      [
        {
          type: 'TRUE_FALSE',
          text: 'Chiara loves dogs',
          points: 100,
          config: { correct: true },
          funFact: 'Milo!',
        },
        { correct: { value: true }, wrong: { value: false } },
      ],
      [
        {
          type: 'SINGLE_CHOICE',
          text: 'Favourite colour?',
          points: 200,
          config: {
            options: [
              { id: 'a', text: 'Pink' },
              { id: 'b', text: 'Blue' },
              { id: 'c', text: 'Gold' },
            ],
            correctOptionId: 'c',
          },
        },
        { correct: { optionId: 'c' }, wrong: { optionId: 'a' } },
      ],
      [
        {
          type: 'MULTIPLE_CHOICE',
          text: 'Family roots?',
          points: 100,
          config: {
            options: [
              { id: 'at', text: 'Austria' },
              { id: 'it', text: 'Italy' },
              { id: 'ca', text: 'Canada' },
              { id: 'fr', text: 'France' },
            ],
            correctOptionIds: ['at', 'it', 'ca'],
          },
        },
        { correct: { optionIds: ['ca', 'at', 'it'] }, wrong: { optionIds: ['at', 'fr'] } },
      ],
      [
        {
          type: 'IMAGE_CHOICE',
          text: 'Which one is Milo?',
          points: 100,
          config: {
            options: [
              { id: 'x', text: '', imageUrl },
              { id: 'y', text: '', imageUrl },
            ],
            correctOptionId: 'y',
          },
        },
        { correct: { optionId: 'y' }, wrong: { optionId: 'x' } },
      ],
      [
        {
          type: 'TYPE_ANSWER',
          text: 'Previous dog?',
          points: 100,
          config: { acceptedAnswers: ['Buba', 'Bubba'] },
        },
        { correct: { text: 'BUBBA!' }, wrong: { text: 'Rex' } },
      ],
      [
        {
          type: 'ORDERING',
          text: 'Order the districts',
          points: 100,
          config: {
            items: [
              { id: '9', text: '9th' },
              { id: '17', text: '17th' },
              { id: '22', text: '22nd' },
            ],
          },
        },
        { correct: { itemIds: ['9', '17', '22'] }, wrong: { itemIds: ['22', '17', '9'] } },
      ],
      [
        {
          type: 'NUMBER_GUESS',
          text: 'How old in this photo?',
          imageUrl,
          points: 100,
          config: { correct: 3, tolerance: 1, unit: 'years' },
        },
        { correct: { value: 4 }, wrong: { value: 30 } },
      ],
      [
        {
          type: 'POLL',
          text: 'Best snack?',
          points: 100,
          config: {
            options: [
              { id: 'p1', text: 'Cake' },
              { id: 'p2', text: 'Chips' },
            ],
          },
        },
        { correct: { optionId: 'p1' }, wrong: { optionId: 'p2' } },
      ],
    ];
    for (const [input, answers] of inputs) {
      await admin(http().post(`/api/admin/quizzes/${quizId}/questions`))
        .send(input)
        .expect(201);
      answersByType.set(input.type, answers);
    }
    questions = (await admin(http().get(`/api/admin/quizzes/${quizId}`)).expect(200)).body
      .questions;
    await admin(http().patch(`/api/admin/quizzes/${quizId}`))
      .send({ enabled: true })
      .expect(200);
    sessionId = (await admin(http().post(`/api/admin/quizzes/${quizId}/sessions`)).expect(201)).body
      .id;

    adminSocket = await connect(server.url, token);
    host = new StateRecorder(adminSocket, ServerEvents.HostState);
    await emitAck(adminSocket, ClientEvents.AdminWatch, { sessionId });
  }, 120_000);

  afterAll(async () => {
    adminSocket?.disconnect();
    bots.forEach((b) => b.socket.disconnect());
    await server.close();
  });

  it('lets 39 players join the lobby at the same time', async () => {
    const joined = await timed('39 simultaneous joins', () =>
      Promise.all(Array.from({ length: PLAYERS - 1 }, (_, i) => joinBot(i))),
    );
    bots.push(...joined);
    const lobby = await host.waitFor(
      (s) => s.players.filter((p) => p.connected).length === PLAYERS - 1,
    );
    expect(lobby.status).toBe('LOBBY');
    const names = new Set(lobby.players.map((p) => p.username));
    expect(names.size).toBe(PLAYERS - 1);
    await Promise.all(bots.map((b) => b.states.waitFor((s) => s.players.length === PLAYERS - 1)));
  });

  it('starts the game for everyone at once', async () => {
    await timed('start reaching all phones', async () => {
      expect(await emitAck(adminSocket, ClientEvents.AdminStart, { sessionId })).toEqual({
        ok: true,
      });
      await Promise.all(bots.map((b) => b.states.waitFor((s) => s.status === 'IN_PROGRESS')));
    });
  });

  it('lets a late guest join mid-game as the 40th player', async () => {
    const late = await joinBot(PLAYERS - 1);
    bots.push(late);
    const state = await late.states.waitFor((s) => s.status === 'IN_PROGRESS');
    expect(state.currentIndex).toBe(0);
    await host.waitFor((s) => s.players.length === PLAYERS);
  });

  it('plays every question with all 40 answering simultaneously', async () => {
    for (const [qi, question] of questions.entries()) {
      await Promise.all(
        bots.map((b) => b.states.waitFor((s) => s.currentIndex === qi && !!s.question)),
      );
      const { correct, wrong } = answersByType.get(question.type)!;

      // Everyone taps at the same moment.
      const acks = await timed(`40 answers to question ${qi + 1}`, () =>
        Promise.all(
          bots.map((b) =>
            emitAck(b.socket, ClientEvents.PlayerAnswer, {
              sessionId,
              questionId: question.id,
              payload: answersCorrectly(b.index, qi) ? correct : wrong,
            }),
          ),
        ),
      );
      expect(acks.every((a) => a.ok)).toBe(true);
      const progress = await host.waitFor(
        (s) => s.currentIndex === qi && s.answeredCount === PLAYERS,
      );
      expect(progress.distribution.length).toBeGreaterThan(0);

      // Nobody can answer twice, even under load.
      const again = await emitAck(bots[0].socket, ClientEvents.PlayerAnswer, {
        sessionId,
        questionId: question.id,
        payload: correct,
      });
      expect(again).toEqual({ ok: false, error: 'You already answered this question' });

      // Halfway through, 10 guests lose connection and come back on a new socket.
      if (qi === 3) {
        const dropped = bots.slice(0, 10);
        dropped.forEach((b) => b.socket.disconnect());
        await host.waitFor((s) => s.players.filter((p) => !p.connected).length === 10);
        for (const b of dropped) {
          b.socket = await connect(server.url);
          b.states = new StateRecorder<PlayerGameState>(b.socket);
          await emitAck(b.socket, ClientEvents.PlayerJoin, { sessionId, playerId: b.player.id });
        }
        const resumed = await Promise.all(
          dropped.map((b) => b.states.waitFor((s) => s.currentIndex === qi && s.myAnswer !== null)),
        );
        expect(resumed.every((s) => s.question?.id === question.id)).toBe(true);
        await host.waitFor((s) => s.players.every((p) => p.connected));
      }

      // Reveal: every phone shows its own result and running score.
      await timed(`reveal ${qi + 1} reaching all phones`, async () => {
        await emitAck(adminSocket, ClientEvents.AdminReveal, { sessionId });
        await Promise.all(
          bots.map((b) => b.states.waitFor((s) => s.currentIndex === qi && s.revealed)),
        );
      });
      for (const b of bots) {
        const state = b.states.latest!;
        const isRight = question.type !== 'POLL' && answersCorrectly(b.index, qi);
        expect(state.myResult?.isCorrect, `${b.player.username} on question ${qi + 1}`).toBe(
          isRight,
        );
        expect(state.myScore).toBe(expectedScore(b.index, qi + 1));
      }
      if (question.type === 'TRUE_FALSE') expect(bots[1].states.latest!.funFact).toBe('Milo!');

      if (qi < questions.length - 1) {
        await emitAck(adminSocket, ClientEvents.AdminNext, { sessionId });
      }
    }
  }, 120_000);

  it('finishes with correct ranks for all 40 players and full results for the admin', async () => {
    await timed('finish reaching all phones', async () => {
      await emitAck(adminSocket, ClientEvents.AdminFinish, { sessionId });
      await Promise.all(bots.map((b) => b.states.waitFor((s) => s.status === 'FINISHED')));
    });

    const scores = bots.map((b) => expectedScore(b.index));
    for (const b of bots) {
      const final = b.states.latest!.final!;
      const higher = scores.filter((s) => s > expectedScore(b.index)).length;
      expect(final.score).toBe(expectedScore(b.index));
      expect(final.rank, `${b.player.username}'s rank`).toBe(higher + 1);
      expect(final.playerCount).toBe(PLAYERS);
      expect(final.podium).toHaveLength(3);
    }

    const results = (
      await admin(http().get(`/api/admin/sessions/${sessionId}/results`)).expect(200)
    ).body;
    expect(results.leaderboard).toHaveLength(PLAYERS);
    expect(results.answers).toHaveLength(PLAYERS * questions.length);
    const ordered = results.leaderboard.map((p: { score: number }) => p.score);
    expect(ordered).toEqual([...ordered].sort((a, b) => b - a));

    const hostFinal = host.latest!;
    expect(hostFinal.status).toBe('FINISHED');
    expect(hostFinal.leaderboard[0].score).toBe(Math.max(...scores));

    const quizzes = (await admin(http().get('/api/admin/quizzes')).expect(200)).body;
    expect(quizzes.find((q: { id: string }) => q.id === quizId).playerCount).toBe(PLAYERS);
  });
});
