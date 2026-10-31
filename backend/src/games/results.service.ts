import { Injectable, NotFoundException } from '@nestjs/common';
import { describeAnswer, describeCorrectAnswer, SessionResults } from '@pop-quiz/shared';
import { SessionsService } from './sessions.service.js';

@Injectable()
export class ResultsService {
  constructor(private readonly sessions: SessionsService) {}

  async getResults(sessionId: string): Promise<SessionResults> {
    const ctx = await this.sessions.loadContext(sessionId);
    if (!ctx) throw new NotFoundException('Game not found');
    const questionsById = new Map(ctx.questions.map((q) => [q.id, q]));

    return {
      session: {
        ...this.sessions.toSummary(ctx.session, ctx.players.length),
        quizTitle: ctx.quiz.title,
      },
      leaderboard: this.sessions.leaderboard(ctx),
      questions: ctx.questions.map((q) => ({
        id: q.id,
        order: q.order,
        text: q.text,
        type: q.type,
        points: q.points,
        correctAnswer: describeCorrectAnswer(q),
      })),
      answers: ctx.answers.flatMap((a) => {
        const question = questionsById.get(a.questionId);
        return question
          ? [
              {
                playerId: a.playerId,
                questionId: a.questionId,
                answerText: describeAnswer(question, a.payload),
                isCorrect: a.isCorrect,
                points: a.points,
              },
            ]
          : [];
      }),
    };
  }
}
