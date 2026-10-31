import type { Question, QuestionType } from '@pop-quiz/shared';
import type { Question as QuestionRow } from '../generated/prisma/client.js';

export function toQuestion(row: QuestionRow): Question {
  return {
    id: row.id,
    quizId: row.quizId,
    order: row.order,
    type: row.type as QuestionType,
    text: row.text,
    imageUrl: row.imageUrl,
    points: row.points,
    config: row.config,
  } as unknown as Question;
}

export function toIso(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}
