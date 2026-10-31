import {
  ClientEvents,
  HostGameState,
  PlayerDto,
  PlayerGameState,
  Question,
  QuizDetail,
  ServerEvents,
} from '@pop-quiz/shared';
import type { Socket } from 'socket.io-client';
import request from 'supertest';
import { connect, emitAck, startServer, StateRecorder, TestServer, TINY_PNG } from './helpers.js';

describe('Pop Quiz full game flow (e2e)', () => {
  let server: TestServer;
  let token: string;
  let quiz: QuizDetail;
  let questions: Question[];
  let alice: PlayerDto;
  let bob: PlayerDto;
  let sessionId: string;
  let adminSocket: Socket;
  let aliceSocket: Socket;
  let bobSocket: Socket;
  let host: StateRecorder<HostGameState>;
  let aliceState: StateRecorder<PlayerGameState>;
  let bobState: StateRecorder<PlayerGameState>;
  const sockets: Socket[] = [];

  const http = () => request(server.url);
  const admin = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    server = await startServer();
  });

  afterAll(async () => {
    sockets.forEach((s) => s.disconnect());
    await server.close();
  });

  it('protects admin routes and logs in with the password', async () => {
    await http().get('/api/admin/quizzes').expect(401);
    await http().post('/api/admin/login').send({ password: '1234' }).expect(401);
    const res = await http().post('/api/admin/login').send({ password: '9999' }).expect(200);
    token = res.body.token;
    expect(token).toBeTruthy();
  });

  it('creates a quiz with every question type', async () => {
    const created = await admin(http().post('/api/admin/quizzes'))
      .send({ title: '  Parisa’s Birthday Bash  ', description: 'How well do you know her?' })
      .expect(201);
    quiz = created.body;
    expect(quiz).toMatchObject({ title: 'Parisa’s Birthday Bash', enabled: false, questionCount: 0 });

    const upload = await admin(http().post('/api/admin/uploads')).attach('file', TINY_PNG, 'cake.png').expect(201);
    const imageUrl: string = upload.body.url;
    await http().get(imageUrl).expect(200);
    await admin(http().post('/api/admin/uploads'))
      .attach('file', Buffer.from('nope'), { filename: 'x.txt', contentType: 'text/plain' })
      .expect(400);

    const inputs = [
      {
        type: 'SINGLE_CHOICE',
        text: 'Favourite cake?',
        imageUrl,
        points: 100,
        config: {
          options: [
            { id: 'choc', text: 'Chocolate' },
            { id: 'van', text: 'Vanilla' },
          ],
          correctOptionId: 'choc',
        },
      },
      {
        type: 'MULTIPLE_CHOICE',
        text: 'Which cities has she lived in?',
        points: 200,
        config: {
          options: [
            { id: 'teh', text: 'Tehran' },
            { id: 'ams', text: 'Amsterdam' },
            { id: 'nyc', text: 'New York' },
          ],
          correctOptionIds: ['teh', 'ams'],
        },
      },
      { type: 'TRUE_FALSE', text: 'She hates coffee', config: { correct: false } },
      {
        type: 'IMAGE_CHOICE',
        text: 'Which one is her dog?',
        config: {
          options: [
            { id: 'd1', text: '', imageUrl },
            { id: 'd2', text: '', imageUrl },
          ],
          correctOptionId: 'd2',
        },
      },
      { type: 'TYPE_ANSWER', text: 'Her favourite band?', config: { acceptedAnswers: ['Coldplay'] } },
      {
        type: 'ORDERING',
        text: 'Order these trips',
        config: {
          items: [
            { id: 't1', text: 'Paris' },
            { id: 't2', text: 'Rome' },
            { id: 't3', text: 'Tokyo' },
          ],
        },
      },
      { type: 'NUMBER_GUESS', text: 'How old is she?', config: { correct: 30, tolerance: 1, unit: 'years' } },
      {
        type: 'POLL',
        text: 'Best party snack?',
        config: {
          options: [
            { id: 'p1', text: 'Chips' },
            { id: 'p2', text: 'Cake' },
          ],
        },
      },
    ];
    for (const input of inputs) {
      await admin(http().post(`/api/admin/quizzes/${quiz.id}/questions`)).send(input).expect(201);
    }

    const invalid = await admin(http().post(`/api/admin/quizzes/${quiz.id}/questions`))
      .send({ type: 'SINGLE_CHOICE', text: '', config: { options: [] } })
      .expect(400);
    expect(invalid.body.message).toContain('Write the question');

    const detail = await admin(http().get(`/api/admin/quizzes/${quiz.id}`)).expect(200);
    questions = detail.body.questions;
    expect(questions.map((q) => q.order)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('edits, reorders and deletes questions', async () => {
    const edited = await admin(http().patch(`/api/admin/questions/${questions[2].id}`))
      .send({ type: 'TRUE_FALSE', text: 'She loves coffee', points: 150, config: { correct: true } })
      .expect(200);
    expect(edited.body).toMatchObject({ text: 'She loves coffee', points: 150 });

    const extra = await admin(http().post(`/api/admin/quizzes/${quiz.id}/questions`))
      .send({ type: 'TRUE_FALSE', text: 'Temp', config: { correct: true } })
      .expect(201);
    await admin(http().delete(`/api/admin/questions/${extra.body.id}`)).expect(204);

    // Move the true/false question to the front.
    const ids = questions.map((q) => q.id);
    const reordered = [ids[2], ...ids.filter((id) => id !== ids[2])];
    await admin(http().put(`/api/admin/quizzes/${quiz.id}/questions/order`)).send({ ids: ids.slice(1) }).expect(400);
    const res = await admin(http().put(`/api/admin/quizzes/${quiz.id}/questions/order`))
      .send({ ids: reordered })
      .expect(200);
    questions = res.body;
    expect(questions.map((q) => q.id)).toEqual(reordered);
    expect(questions[0].text).toBe('She loves coffee');
  });

  it('only shows enabled quizzes to gamers', async () => {
    expect((await http().get('/api/games').expect(200)).body).toEqual([]);
    await admin(http().patch(`/api/admin/quizzes/${quiz.id}`)).send({ enabled: true }).expect(200);
    const games = (await http().get('/api/games').expect(200)).body;
    expect(games).toEqual([
      expect.objectContaining({ quizId: quiz.id, questionCount: 8, session: null }),
    ]);
  });

  it('registers gamers with unique names', async () => {
    alice = (await http().post('/api/players').send({ username: ' Alice ' }).expect(201)).body;
    bob = (await http().post('/api/players').send({ username: 'Bob' }).expect(201)).body;
    expect(alice.username).toBe('Alice');
    await http().post('/api/players').send({ username: 'alice' }).expect(409);
    await http().post('/api/players').send({ username: 'x' }).expect(400);
    expect((await http().get(`/api/players/${alice.id}`).expect(200)).body).toEqual(alice);
  });

  it('lets gamers join the same lobby', async () => {
    const a = await http().post(`/api/games/${quiz.id}/join`).send({ playerId: alice.id }).expect(200);
    const b = await http().post(`/api/games/${quiz.id}/join`).send({ playerId: bob.id }).expect(200);
    sessionId = a.body.sessionId;
    expect(b.body.sessionId).toBe(sessionId);
    await http().post(`/api/games/${quiz.id}/join`).send({ playerId: 'ghost' }).expect(404);

    const games = (await http().get('/api/games')).body;
    expect(games[0].session).toEqual({ id: sessionId, status: 'LOBBY', playerCount: 2 });
  });

  it('pushes the lobby in real time', async () => {
    adminSocket = await connect(server.url, token);
    aliceSocket = await connect(server.url);
    bobSocket = await connect(server.url);
    sockets.push(adminSocket, aliceSocket, bobSocket);
    host = new StateRecorder(adminSocket, ServerEvents.HostState);
    aliceState = new StateRecorder(aliceSocket);
    bobState = new StateRecorder(bobSocket);

    expect(await emitAck(adminSocket, ClientEvents.AdminWatch, { sessionId })).toEqual({ ok: true });
    expect(await emitAck(aliceSocket, ClientEvents.PlayerJoin, { sessionId, playerId: alice.id })).toEqual({
      ok: true,
    });
    const lobby = await aliceState.waitFor((s) => s.status === 'LOBBY');
    expect(lobby.question).toBeNull();
    expect(lobby.totalQuestions).toBe(8);

    await emitAck(bobSocket, ClientEvents.PlayerJoin, { sessionId, playerId: bob.id });
    const hostLobby = await host.waitFor((s) => s.players.filter((p) => p.connected).length === 2);
    expect(hostLobby.players.map((p) => p.username)).toEqual(['Alice', 'Bob']);

    // Wrong session or non-admin actions are refused.
    expect(await emitAck(aliceSocket, ClientEvents.PlayerJoin, { sessionId: 'nope', playerId: alice.id })).toMatchObject({
      ok: false,
    });
    expect(await emitAck(aliceSocket, ClientEvents.AdminStart, { sessionId })).toEqual({
      ok: false,
      error: 'Admin login required',
    });
    expect(
      await emitAck(aliceSocket, ClientEvents.PlayerAnswer, {
        sessionId,
        questionId: questions[0].id,
        payload: { value: true },
      }),
    ).toEqual({ ok: false, error: "The game isn't running" });
  });

  it('starts the game and unlocks question 1 for everyone, without leaking answers', async () => {
    expect(await emitAck(adminSocket, ClientEvents.AdminStart, { sessionId })).toEqual({ ok: true });
    const a = await aliceState.waitFor((s) => s.status === 'IN_PROGRESS');
    const b = await bobState.waitFor((s) => s.status === 'IN_PROGRESS');
    expect(a.currentIndex).toBe(0);
    expect(b.question?.id).toBe(questions[0].id);
    expect(JSON.stringify(a.question)).not.toMatch(/correct/);
    expect(a.revealed).toBe(false);

    // Editing a quiz that is being played is blocked.
    await admin(http().patch(`/api/admin/questions/${questions[0].id}`))
      .send({ type: 'TRUE_FALSE', text: 'x', config: { correct: true } })
      .expect(409);
    await admin(http().delete(`/api/admin/quizzes/${quiz.id}`)).expect(409);
  });

  it('stores answers immediately and shows live progress to the host', async () => {
    const q = questions[0].id;
    expect(await emitAck(aliceSocket, ClientEvents.PlayerAnswer, { sessionId, questionId: q, payload: { value: true } })).toEqual({
      ok: true,
    });
    expect(await emitAck(aliceSocket, ClientEvents.PlayerAnswer, { sessionId, questionId: q, payload: { value: false } })).toEqual({
      ok: false,
      error: 'You already answered this question',
    });
    expect(
      await emitAck(bobSocket, ClientEvents.PlayerAnswer, { sessionId, questionId: questions[1].id, payload: {} }),
    ).toMatchObject({ ok: false, error: 'This question is closed. Follow the host!' });
    expect(await emitAck(bobSocket, ClientEvents.PlayerAnswer, { sessionId, questionId: q, payload: { value: 'x' } })).toEqual({
      ok: false,
      error: 'That answer is not valid',
    });
    await emitAck(bobSocket, ClientEvents.PlayerAnswer, { sessionId, questionId: q, payload: { value: false } });

    const stored = await server.db.prisma.answer.findMany({ where: { sessionId } });
    expect(stored).toHaveLength(2);

    const progress = await host.waitFor((s) => s.answeredCount === 2);
    expect(progress.distribution).toEqual([
      expect.objectContaining({ label: 'True', count: 1, correct: true }),
      expect.objectContaining({ label: 'False', count: 1, correct: false }),
    ]);
    const mine = await aliceState.waitFor((s) => s.myAnswer !== null);
    expect(mine.myAnswer).toEqual({ value: true });
    expect(mine.myResult).toBeNull();
    expect(mine.myScore).toBe(0);
  });

  it('reveals the answer and scores', async () => {
    await emitAck(adminSocket, ClientEvents.AdminReveal, { sessionId });
    const a = await aliceState.waitFor((s) => s.revealed);
    const b = await bobState.waitFor((s) => s.revealed);
    expect(a.myResult).toEqual({ isCorrect: true, points: 150 });
    expect(a.myScore).toBe(150);
    expect(a.correctAnswerText).toBe('True');
    expect(b.myResult).toEqual({ isCorrect: false, points: 0 });
  });

  it('only the host moves forward and back', async () => {
    await emitAck(adminSocket, ClientEvents.AdminNext, { sessionId });
    const second = await aliceState.waitFor((s) => s.currentIndex === 1);
    expect(second.question?.text).toBe('Favourite cake?');
    expect(second.myAnswer).toBeNull();

    await emitAck(adminSocket, ClientEvents.AdminPrev, { sessionId });
    const back = await aliceState.waitFor((s) => s.currentIndex === 0);
    expect(back.myAnswer).toEqual({ value: true });
    expect(await emitAck(adminSocket, ClientEvents.AdminPrev, { sessionId })).toEqual({
      ok: false,
      error: 'Already at the first question',
    });
    await emitAck(adminSocket, ClientEvents.AdminNext, { sessionId });
    await bobState.waitFor((s) => s.currentIndex === 1);
  });

  it('resumes a gamer who closed the app at the current question', async () => {
    bobSocket.disconnect();
    const hostSeesOffline = await host.waitFor((s) => s.players.some((p) => p.username === 'Bob' && !p.connected));
    expect(hostSeesOffline).toBeTruthy();

    bobSocket = await connect(server.url);
    sockets.push(bobSocket);
    bobState = new StateRecorder(bobSocket);
    await emitAck(bobSocket, ClientEvents.PlayerJoin, { sessionId, playerId: bob.id });
    const resumed = await bobState.waitFor((s) => s.status === 'IN_PROGRESS');
    expect(resumed.currentIndex).toBe(1);
    expect(resumed.question?.text).toBe('Favourite cake?');
    expect(resumed.myScore).toBe(0);
  });

  it('plays through the rest of the quiz', async () => {
    const answers: Record<string, [unknown, unknown]> = {
      SINGLE_CHOICE: [{ optionId: 'choc' }, { optionId: 'van' }],
      MULTIPLE_CHOICE: [{ optionIds: ['teh', 'ams'] }, { optionIds: ['teh'] }],
      IMAGE_CHOICE: [{ optionId: 'd2' }, { optionId: 'd2' }],
      TYPE_ANSWER: [{ text: 'coldplay!' }, { text: 'Muse' }],
      ORDERING: [{ itemIds: ['t1', 't2', 't3'] }, { itemIds: ['t3', 't2', 't1'] }],
      NUMBER_GUESS: [{ value: 31 }, { value: 30 }],
      POLL: [{ optionId: 'p2' }, { optionId: 'p1' }],
    };

    for (let index = 1; index < questions.length; index++) {
      const question = questions[index];
      await aliceState.waitFor((s) => s.currentIndex === index);
      const [forAlice, forBob] = answers[question.type];
      expect((await emitAck(aliceSocket, ClientEvents.PlayerAnswer, { sessionId, questionId: question.id, payload: forAlice })).ok).toBe(true);
      expect((await emitAck(bobSocket, ClientEvents.PlayerAnswer, { sessionId, questionId: question.id, payload: forBob })).ok).toBe(true);
      await emitAck(adminSocket, ClientEvents.AdminReveal, { sessionId });
      if (index < questions.length - 1) await emitAck(adminSocket, ClientEvents.AdminNext, { sessionId });
    }
    expect(await emitAck(adminSocket, ClientEvents.AdminNext, { sessionId })).toEqual({
      ok: false,
      error: 'That was the last question',
    });
  });

  it('finishes with a podium for gamers and full results for the admin', async () => {
    await emitAck(adminSocket, ClientEvents.AdminFinish, { sessionId });
    const a = await aliceState.waitFor((s) => s.status === 'FINISHED');
    const b = await bobState.waitFor((s) => s.status === 'FINISHED');

    // Alice: 150 + 100 + 200 + 100 + 100 + 100 + 100 = 850. Bob: image (100) + number (100) = 200.
    expect(a.final).toMatchObject({ rank: 1, score: 850, playerCount: 2 });
    expect(b.final).toMatchObject({ rank: 2, score: 200 });
    expect(a.final?.podium.map((p) => p.username)).toEqual(['Alice', 'Bob']);

    const results = (await admin(http().get(`/api/admin/sessions/${sessionId}/results`)).expect(200)).body;
    expect(results.session).toMatchObject({ status: 'FINISHED', quizTitle: 'Parisa’s Birthday Bash', playerCount: 2 });
    expect(results.leaderboard[0]).toMatchObject({ username: 'Alice', score: 850, correctCount: 7, answeredCount: 7 });
    expect(results.answers).toHaveLength(16);
    expect(results.answers).toContainEqual(
      expect.objectContaining({ playerId: bob.id, answerText: 'Muse', isCorrect: false }),
    );

    const list = (await admin(http().get('/api/admin/quizzes')).expect(200)).body;
    expect(list[0]).toMatchObject({ playerCount: 2, sessionCount: 1, activeSession: null });
    const sessions = (await admin(http().get(`/api/admin/quizzes/${quiz.id}/sessions`)).expect(200)).body;
    expect(sessions).toHaveLength(1);
    expect((await http().get('/api/games')).body[0].session).toBeNull();
  });

  it('opens a fresh lobby for the next round and can delete the quiz', async () => {
    const opened = (await admin(http().post(`/api/admin/quizzes/${quiz.id}/sessions`)).expect(201)).body;
    expect(opened.id).not.toBe(sessionId);
    expect(opened.status).toBe('LOBBY');
    await admin(http().delete(`/api/admin/quizzes/${quiz.id}`)).expect(204);
    await admin(http().get(`/api/admin/quizzes/${quiz.id}`)).expect(404);
  });
});
