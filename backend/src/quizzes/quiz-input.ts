import { BadRequestException } from '@nestjs/common';
import type { QuizInput } from '@pop-quiz/shared';

const optionalString = (value: unknown, field: string, max: number): string | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') throw new BadRequestException(`${field} must be text`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new BadRequestException(`${field} is too long (max ${max})`);
  return trimmed || null;
};

/** Validates quiz create/update bodies. With `partial`, missing fields are left untouched. */
export function parseQuizInput(body: unknown, partial: boolean): Partial<QuizInput> {
  if (typeof body !== 'object' || body === null) throw new BadRequestException('Quiz is required');
  const raw = body as Record<string, unknown>;
  const result: Partial<QuizInput> = {};

  if (raw['title'] !== undefined || !partial) {
    const title = typeof raw['title'] === 'string' ? raw['title'].trim() : '';
    if (!title) throw new BadRequestException('Give the quiz a title');
    if (title.length > 120) throw new BadRequestException('Title is too long (max 120)');
    result.title = title;
  }

  const description = optionalString(raw['description'], 'Description', 1000);
  if (description !== undefined) result.description = description;

  const coverImageUrl = optionalString(raw['coverImageUrl'], 'Cover image', 500);
  if (coverImageUrl !== undefined) result.coverImageUrl = coverImageUrl;

  if (raw['enabled'] !== undefined) {
    if (typeof raw['enabled'] !== 'boolean') throw new BadRequestException('Enabled must be true or false');
    result.enabled = raw['enabled'];
  }
  return result;
}
