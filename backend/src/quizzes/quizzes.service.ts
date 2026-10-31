import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { QuizDetail, QuizSummary } from '@pop-quiz/shared';
import { toQuestion } from '../common/mappers.js';
import { RealtimeService } from '../games/realtime.service.js';
import { SessionsService } from '../games/sessions.service.js';
import type { Quiz } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { parseQuizInput } from './quiz-input.js';

@Injectable()
export class QuizzesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionsService,
    private readonly realtime: RealtimeService,
  ) {}

  async list(): Promise<QuizSummary[]> {
    const quizzes = await this.prisma.quiz.findMany({ orderBy: { createdAt: 'desc' } });
    return Promise.all(quizzes.map((quiz) => this.summarize(quiz)));
  }

  async get(id: string): Promise<QuizDetail> {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      include: { questions: { orderBy: { order: 'asc' } } },
    });
    if (!quiz) throw new NotFoundException('Quiz not found');
    const { questions, ...rest } = quiz;
    return { ...(await this.summarize(rest)), questions: questions.map(toQuestion) };
  }

  async create(body: unknown): Promise<QuizDetail> {
    const input = parseQuizInput(body, false);
    const quiz = await this.prisma.quiz.create({
      data: {
        title: input.title!,
        description: input.description ?? null,
        coverImageUrl: input.coverImageUrl ?? null,
        enabled: input.enabled ?? false,
      },
    });
    if (quiz.enabled) this.realtime.gamesChanged();
    return this.get(quiz.id);
  }

  async update(id: string, body: unknown): Promise<QuizDetail> {
    const input = parseQuizInput(body, true);
    await this.requireQuiz(id);
    await this.prisma.quiz.update({ where: { id }, data: input });
    this.realtime.gamesChanged();
    return this.get(id);
  }

  async remove(id: string): Promise<void> {
    await this.requireQuiz(id);
    if (await this.sessions.hasLiveSession(id)) {
      throw new ConflictException('Finish the running game before deleting this quiz');
    }
    await this.prisma.quiz.delete({ where: { id } });
    this.realtime.gamesChanged();
  }

  async requireQuiz(id: string): Promise<Quiz> {
    const quiz = await this.prisma.quiz.findUnique({ where: { id } });
    if (!quiz) throw new NotFoundException('Quiz not found');
    return quiz;
  }

  private async summarize(quiz: Quiz): Promise<QuizSummary> {
    const [questionCount, sessionCount, players, activeSession] = await Promise.all([
      this.prisma.question.count({ where: { quizId: quiz.id } }),
      this.prisma.gameSession.count({ where: { quizId: quiz.id, startedAt: { not: null } } }),
      this.prisma.sessionPlayer.findMany({
        where: { session: { quizId: quiz.id, startedAt: { not: null } } },
        distinct: ['playerId'],
        select: { playerId: true },
      }),
      this.sessions.activeSessionInfo(quiz.id),
    ]);
    return {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      coverImageUrl: quiz.coverImageUrl,
      enabled: quiz.enabled,
      questionCount,
      playerCount: players.length,
      sessionCount,
      activeSession,
      createdAt: quiz.createdAt.toISOString(),
      updatedAt: quiz.updatedAt.toISOString(),
    };
  }
}
