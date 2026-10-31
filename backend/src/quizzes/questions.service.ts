import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Question, validateQuestionInput } from '@pop-quiz/shared';
import { toQuestion } from '../common/mappers.js';
import { SessionsService } from '../games/sessions.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class QuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionsService,
  ) {}

  async create(quizId: string, body: unknown): Promise<Question> {
    await this.assertEditable(quizId);
    const input = this.parse(body);
    const last = await this.prisma.question.findFirst({
      where: { quizId },
      orderBy: { order: 'desc' },
    });
    const row = await this.prisma.question.create({
      data: { ...input, config: input.config as object, quizId, order: (last?.order ?? -1) + 1 },
    });
    return toQuestion(row);
  }

  async update(id: string, body: unknown): Promise<Question> {
    const existing = await this.requireQuestion(id);
    await this.assertEditable(existing.quizId);
    const input = this.parse(body);
    const row = await this.prisma.question.update({
      where: { id },
      data: { ...input, config: input.config as object },
    });
    return toQuestion(row);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.requireQuestion(id);
    await this.assertEditable(existing.quizId);
    await this.prisma.$transaction(async (tx) => {
      await tx.question.delete({ where: { id } });
      const rest = await tx.question.findMany({ where: { quizId: existing.quizId }, orderBy: { order: 'asc' } });
      for (const [order, q] of rest.entries()) {
        if (q.order !== order) await tx.question.update({ where: { id: q.id }, data: { order } });
      }
    });
  }

  /** Saves a new order. `ids` must contain every question of the quiz exactly once. */
  async reorder(quizId: string, ids: unknown): Promise<Question[]> {
    await this.assertEditable(quizId);
    const current = await this.prisma.question.findMany({ where: { quizId } });
    const valid =
      Array.isArray(ids) &&
      ids.length === current.length &&
      new Set(ids).size === ids.length &&
      ids.every((id) => current.some((q) => q.id === id));
    if (!valid) throw new BadRequestException('The new order must include every question once');

    await this.prisma.$transaction(
      (ids as string[]).map((id, order) => this.prisma.question.update({ where: { id }, data: { order } })),
    );
    const rows = await this.prisma.question.findMany({ where: { quizId }, orderBy: { order: 'asc' } });
    return rows.map(toQuestion);
  }

  private parse(body: unknown) {
    const result = validateQuestionInput(body);
    if (!result.valid) throw new BadRequestException(result.errors);
    return result.value;
  }

  private async requireQuestion(id: string) {
    const question = await this.prisma.question.findUnique({ where: { id } });
    if (!question) throw new NotFoundException('Question not found');
    return question;
  }

  private async assertEditable(quizId: string): Promise<void> {
    const quiz = await this.prisma.quiz.findUnique({ where: { id: quizId } });
    if (!quiz) throw new NotFoundException('Quiz not found');
    if (await this.sessions.hasLiveSession(quizId)) {
      throw new ConflictException("This quiz is being played right now. Edit it after the game ends");
    }
  }
}
