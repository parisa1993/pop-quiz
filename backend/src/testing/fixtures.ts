import type { PrismaService } from '../prisma/prisma.service.js';

/** A quiz with a true/false (100 pts) and a single-choice (200 pts) question. */
export async function seedQuiz(prisma: PrismaService, { enabled = true, title = 'Birthday' } = {}) {
  const quiz = await prisma.quiz.create({ data: { title, enabled } });
  const trueFalse = await prisma.question.create({
    data: {
      quizId: quiz.id,
      order: 0,
      type: 'TRUE_FALSE',
      text: 'Cake is great',
      config: { correct: true },
    },
  });
  const choice = await prisma.question.create({
    data: {
      quizId: quiz.id,
      order: 1,
      type: 'SINGLE_CHOICE',
      text: 'Best flavour?',
      points: 200,
      config: {
        options: [
          { id: 'a', text: 'Chocolate' },
          { id: 'b', text: 'Lemon' },
        ],
        correctOptionId: 'a',
      },
    },
  });
  return { quiz, questions: [trueFalse, choice] };
}

export function seedPlayer(prisma: PrismaService, username: string) {
  return prisma.player.create({ data: { username, usernameKey: username.toLowerCase() } });
}
