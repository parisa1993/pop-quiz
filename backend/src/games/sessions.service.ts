import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActiveSessionInfo,
  answerDistribution,
  AnswerPayload,
  describeCorrectAnswer,
  GameListItem,
  gradeAnswer,
  HostGameState,
  isScored,
  isValidAnswerPayload,
  PlayerGameState,
  Question,
  rankPlayers,
  RankedPlayer,
  SessionStatus,
  SessionSummary,
  toPublicQuestion,
} from '@pop-quiz/shared';
import { toIso, toQuestion } from '../common/mappers.js';
import type { GameSession, Quiz } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const ACTIVE: SessionStatus[] = ['LOBBY', 'IN_PROGRESS'];

interface AnswerRow {
  playerId: string;
  questionId: string;
  payload: AnswerPayload;
  isCorrect: boolean;
  points: number;
}

/** Everything needed to render any view of a session, loaded in one go. */
export interface SessionContext {
  session: GameSession;
  quiz: Quiz;
  questions: Question[];
  players: { id: string; username: string }[];
  answers: AnswerRow[];
  revealedIds: Set<string>;
}

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- Queries ----------

  async loadContext(sessionId: string): Promise<SessionContext | null> {
    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: {
        quiz: { include: { questions: { orderBy: { order: 'asc' } } } },
        players: { include: { player: true }, orderBy: { joinedAt: 'asc' } },
        answers: true,
      },
    });
    if (!session) return null;
    const { quiz, players, answers, ...rest } = session;
    const { questions, ...quizRest } = quiz;
    return {
      session: rest,
      quiz: quizRest,
      questions: questions.map(toQuestion),
      players: players.map((p) => ({ id: p.player.id, username: p.player.username })),
      answers: answers.map((a) => ({
        playerId: a.playerId,
        questionId: a.questionId,
        payload: a.payload as unknown as AnswerPayload,
        isCorrect: a.isCorrect,
        points: a.points,
      })),
      revealedIds: new Set(rest.revealedQuestionIds as string[]),
    };
  }

  async activeSessionInfo(quizId: string): Promise<ActiveSessionInfo | null> {
    const session = await this.prisma.gameSession.findFirst({
      where: { quizId, status: { in: ACTIVE } },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { players: true } } },
    });
    return session
      ? {
          id: session.id,
          status: session.status as SessionStatus,
          playerCount: session._count.players,
        }
      : null;
  }

  async hasLiveSession(quizId: string): Promise<boolean> {
    const count = await this.prisma.gameSession.count({ where: { quizId, status: 'IN_PROGRESS' } });
    return count > 0;
  }

  /** Enabled quizzes with at least one question, for the gamer's game list. */
  async listGames(): Promise<GameListItem[]> {
    const quizzes = await this.prisma.quiz.findMany({
      where: { enabled: true, questions: { some: {} } },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { questions: true } } },
    });
    return Promise.all(
      quizzes.map(async (quiz) => ({
        quizId: quiz.id,
        title: quiz.title,
        description: quiz.description,
        coverImageUrl: quiz.coverImageUrl,
        questionCount: quiz._count.questions,
        session: await this.activeSessionInfo(quiz.id),
      })),
    );
  }

  async listSessions(quizId: string): Promise<SessionSummary[]> {
    const sessions = await this.prisma.gameSession.findMany({
      where: { quizId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { players: true } } },
    });
    return sessions.map((s) => this.toSummary(s, s._count.players));
  }

  toSummary(session: GameSession, playerCount: number): SessionSummary {
    return {
      id: session.id,
      quizId: session.quizId,
      status: session.status as SessionStatus,
      playerCount,
      createdAt: session.createdAt.toISOString(),
      startedAt: toIso(session.startedAt),
      finishedAt: toIso(session.finishedAt),
    };
  }

  async isPlayerInSession(sessionId: string, playerId: string): Promise<boolean> {
    const link = await this.prisma.sessionPlayer.findUnique({
      where: { sessionId_playerId: { sessionId, playerId } },
    });
    return link !== null;
  }

  // ---------- Joining ----------

  /** Returns the quiz's lobby or live session, creating a lobby when there is none. */
  async openSession(quizId: string): Promise<GameSession> {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: { _count: { select: { questions: true } } },
    });
    if (!quiz) throw new NotFoundException('Quiz not found');
    if (quiz._count.questions === 0)
      throw new BadRequestException('Add at least one question first');

    const existing = await this.prisma.gameSession.findFirst({
      where: { quizId, status: { in: ACTIVE } },
      orderBy: { createdAt: 'desc' },
    });
    return existing ?? this.prisma.gameSession.create({ data: { quizId } });
  }

  /** A gamer picks a game from the list. */
  async joinQuiz(quizId: string, playerId: string): Promise<string> {
    const quiz = await this.prisma.quiz.findUnique({ where: { id: quizId } });
    if (!quiz || !quiz.enabled) throw new NotFoundException("This game isn't available right now");
    const player = await this.prisma.player.findUnique({ where: { id: playerId } });
    if (!player) throw new NotFoundException('Player not found, please pick your name again');

    const session = await this.openSession(quizId);
    await this.prisma.sessionPlayer.upsert({
      where: { sessionId_playerId: { sessionId: session.id, playerId } },
      create: { sessionId: session.id, playerId },
      update: {},
    });
    return session.id;
  }

  // ---------- Host controls ----------

  async start(sessionId: string): Promise<void> {
    const ctx = await this.requireContext(sessionId);
    if (ctx.session.status !== 'LOBBY') throw new ConflictException('The game has already started');
    if (ctx.questions.length === 0) throw new BadRequestException('This quiz has no questions');
    await this.prisma.gameSession.update({
      where: { id: sessionId },
      data: { status: 'IN_PROGRESS', currentIndex: 0, startedAt: new Date() },
    });
  }

  async move(sessionId: string, step: 1 | -1): Promise<void> {
    const ctx = await this.requireLive(sessionId);
    const next = ctx.session.currentIndex + step;
    if (next < 0) throw new ConflictException('Already at the first question');
    if (next >= ctx.questions.length) throw new ConflictException('That was the last question');
    await this.prisma.gameSession.update({
      where: { id: sessionId },
      data: { currentIndex: next },
    });
  }

  async reveal(sessionId: string): Promise<void> {
    const ctx = await this.requireLive(sessionId);
    const current = ctx.questions[ctx.session.currentIndex];
    if (ctx.revealedIds.has(current.id)) return;
    await this.prisma.gameSession.update({
      where: { id: sessionId },
      data: { revealedQuestionIds: [...ctx.revealedIds, current.id] },
    });
  }

  async finish(sessionId: string): Promise<void> {
    const ctx = await this.requireContext(sessionId);
    if (ctx.session.status === 'FINISHED') return;
    await this.prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        status: 'FINISHED',
        finishedAt: new Date(),
        startedAt: ctx.session.startedAt ?? new Date(),
        revealedQuestionIds: ctx.questions.map((q) => q.id),
      },
    });
  }

  // ---------- Answers ----------

  async submitAnswer(
    sessionId: string,
    playerId: string,
    questionId: string,
    payload: unknown,
  ): Promise<void> {
    const ctx = await this.requireContext(sessionId);
    if (ctx.session.status !== 'IN_PROGRESS') throw new ConflictException("The game isn't running");
    if (!ctx.players.some((p) => p.id === playerId))
      throw new ConflictException('Join the game first');

    const current = ctx.questions[ctx.session.currentIndex];
    if (!current || current.id !== questionId) {
      throw new ConflictException('This question is closed. Follow the host!');
    }
    if (ctx.revealedIds.has(current.id))
      throw new ConflictException('Too late, the answer was revealed');
    if (ctx.answers.some((a) => a.playerId === playerId && a.questionId === questionId)) {
      throw new ConflictException('You already answered this question');
    }
    if (!isValidAnswerPayload(current, payload))
      throw new BadRequestException('That answer is not valid');

    const { isCorrect, points } = gradeAnswer(current, payload);
    try {
      await this.prisma.answer.create({
        data: { sessionId, playerId, questionId, payload: payload as object, isCorrect, points },
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException('You already answered this question');
      }
      throw error;
    }
  }

  // ---------- Snapshots ----------

  leaderboard(ctx: SessionContext, onlyRevealed = false): RankedPlayer[] {
    const scored = new Set(ctx.questions.filter(isScored).map((q) => q.id));
    return rankPlayers(
      ctx.players.map((player) => {
        const mine = ctx.answers.filter(
          (a) =>
            a.playerId === player.id &&
            scored.has(a.questionId) &&
            (!onlyRevealed || ctx.revealedIds.has(a.questionId)),
        );
        return {
          playerId: player.id,
          username: player.username,
          score: mine.reduce((sum, a) => sum + a.points, 0),
          correctCount: mine.filter((a) => a.isCorrect).length,
          answeredCount: mine.length,
        };
      }),
    );
  }

  private currentQuestion(ctx: SessionContext): Question | null {
    return ctx.session.status === 'IN_PROGRESS'
      ? (ctx.questions[ctx.session.currentIndex] ?? null)
      : null;
  }

  buildPlayerState(ctx: SessionContext, playerId: string, connected: Set<string>): PlayerGameState {
    const question = this.currentQuestion(ctx);
    const revealed = question ? ctx.revealedIds.has(question.id) : false;
    const myAnswer = question
      ? ctx.answers.find((a) => a.playerId === playerId && a.questionId === question.id)
      : undefined;
    const finished = ctx.session.status === 'FINISHED';
    const board = this.leaderboard(ctx, !finished);
    const me = board.find((p) => p.playerId === playerId);

    return {
      sessionId: ctx.session.id,
      quizTitle: ctx.quiz.title,
      status: ctx.session.status as SessionStatus,
      currentIndex: ctx.session.currentIndex,
      totalQuestions: ctx.questions.length,
      players: ctx.players.map((p) => ({ ...p, connected: connected.has(p.id) })),
      question: question ? toPublicQuestion(question) : null,
      revealed,
      myAnswer: myAnswer?.payload ?? null,
      myResult:
        revealed && myAnswer ? { isCorrect: myAnswer.isCorrect, points: myAnswer.points } : null,
      correctAnswerText: revealed && question ? describeCorrectAnswer(question) : null,
      myScore: me?.score ?? 0,
      final:
        finished && me
          ? { rank: me.rank, score: me.score, playerCount: board.length, podium: board.slice(0, 3) }
          : null,
    };
  }

  buildHostState(ctx: SessionContext, connected: Set<string>): HostGameState {
    const question = this.currentQuestion(ctx);
    const current = question ? ctx.answers.filter((a) => a.questionId === question.id) : [];
    const board = this.leaderboard(ctx);
    const answered = new Set(current.map((a) => a.playerId));

    return {
      sessionId: ctx.session.id,
      quizId: ctx.quiz.id,
      quizTitle: ctx.quiz.title,
      status: ctx.session.status as SessionStatus,
      currentIndex: ctx.session.currentIndex,
      totalQuestions: ctx.questions.length,
      question,
      correctAnswerText: question ? describeCorrectAnswer(question) : null,
      revealed: question ? ctx.revealedIds.has(question.id) : false,
      players: ctx.players.map((p) => ({
        ...p,
        connected: connected.has(p.id),
        score: board.find((b) => b.playerId === p.id)?.score ?? 0,
        answeredCurrent: answered.has(p.id),
      })),
      answeredCount: current.length,
      distribution: question
        ? answerDistribution(
            question,
            current.map((a) => a.payload),
          )
        : [],
      leaderboard: board,
    };
  }

  // ---------- Helpers ----------

  private async requireContext(sessionId: string): Promise<SessionContext> {
    const ctx = await this.loadContext(sessionId);
    if (!ctx) throw new NotFoundException('Game not found');
    return ctx;
  }

  private async requireLive(sessionId: string): Promise<SessionContext> {
    const ctx = await this.requireContext(sessionId);
    if (ctx.session.status !== 'IN_PROGRESS') throw new ConflictException("The game isn't running");
    return ctx;
  }
}
