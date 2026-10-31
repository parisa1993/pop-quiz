import { AnswerPayload, AnswerPayloadMap, OrderItem, PublicQuestion, Question } from './question-types.js';

export interface GradeResult {
  isCorrect: boolean;
  points: number;
}

/** Lower-cases, strips accents and punctuation, and collapses whitespace. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isCorrect(question: Question, payload: AnswerPayload): boolean {
  switch (question.type) {
    case 'SINGLE_CHOICE':
    case 'IMAGE_CHOICE':
      return (payload as AnswerPayloadMap['SINGLE_CHOICE']).optionId === question.config.correctOptionId;
    case 'MULTIPLE_CHOICE': {
      const picked = new Set((payload as AnswerPayloadMap['MULTIPLE_CHOICE']).optionIds);
      const correct = question.config.correctOptionIds;
      return picked.size === correct.length && correct.every((id) => picked.has(id));
    }
    case 'TRUE_FALSE':
      return (payload as AnswerPayloadMap['TRUE_FALSE']).value === question.config.correct;
    case 'TYPE_ANSWER': {
      const given = normalizeText((payload as AnswerPayloadMap['TYPE_ANSWER']).text);
      return question.config.acceptedAnswers.some((a) => normalizeText(a) === given);
    }
    case 'ORDERING': {
      const ids = (payload as AnswerPayloadMap['ORDERING']).itemIds;
      return question.config.items.every((item, i) => ids[i] === item.id);
    }
    case 'NUMBER_GUESS': {
      const value = (payload as AnswerPayloadMap['NUMBER_GUESS']).value;
      return Math.abs(value - question.config.correct) <= question.config.tolerance;
    }
    case 'POLL':
      return false;
  }
}

/** Flat scoring: a correct answer earns the question's points, anything else earns 0. */
export function gradeAnswer(question: Question, payload: AnswerPayload): GradeResult {
  const correct = isCorrect(question, payload);
  return { isCorrect: correct, points: correct ? question.points : 0 };
}

/** Polls have no right answer, so they never count towards the score or correct count. */
export function isScored(question: Pick<Question, 'type'>): boolean {
  return question.type !== 'POLL';
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Deterministic shuffle so every player (and every reconnect) sees the same scrambled order. */
export function shuffleItems(items: OrderItem[], seed: string): OrderItem[] {
  const result = [...items];
  let state = hashString(seed) || 1;
  for (let i = result.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  const unchanged = result.every((item, i) => item.id === items[i].id);
  if (unchanged && result.length > 1) result.push(result.shift()!);
  return result;
}

/** Strips anything that would give the answer away before sending a question to gamers. */
export function toPublicQuestion(question: Question): PublicQuestion {
  const base = {
    id: question.id,
    type: question.type,
    text: question.text,
    imageUrl: question.imageUrl ?? null,
    points: question.points,
  };
  switch (question.type) {
    case 'SINGLE_CHOICE':
    case 'IMAGE_CHOICE':
    case 'POLL':
      return { ...base, config: { options: question.config.options } };
    case 'MULTIPLE_CHOICE':
      return { ...base, config: { options: question.config.options, multiple: true } };
    case 'ORDERING':
      return { ...base, config: { items: shuffleItems(question.config.items, question.id) } };
    case 'NUMBER_GUESS':
      return { ...base, config: { unit: question.config.unit ?? null } };
    case 'TRUE_FALSE':
    case 'TYPE_ANSWER':
      return { ...base, config: {} };
  }
}

/** Human-readable version of an answer, for results tables. */
export function describeAnswer(question: Question, payload: AnswerPayload | null): string {
  if (!payload) return '—';
  switch (question.type) {
    case 'SINGLE_CHOICE':
    case 'IMAGE_CHOICE':
    case 'POLL': {
      const id = (payload as AnswerPayloadMap['SINGLE_CHOICE']).optionId;
      const index = question.config.options.findIndex((o) => o.id === id);
      const option = question.config.options[index];
      return option ? option.text || `Picture ${index + 1}` : '—';
    }
    case 'MULTIPLE_CHOICE': {
      const ids = (payload as AnswerPayloadMap['MULTIPLE_CHOICE']).optionIds;
      return question.config.options
        .filter((o) => ids.includes(o.id))
        .map((o) => o.text)
        .join(', ');
    }
    case 'TRUE_FALSE':
      return (payload as AnswerPayloadMap['TRUE_FALSE']).value ? 'True' : 'False';
    case 'TYPE_ANSWER':
      return (payload as AnswerPayloadMap['TYPE_ANSWER']).text;
    case 'ORDERING': {
      const ids = (payload as AnswerPayloadMap['ORDERING']).itemIds;
      return ids
        .map((id) => question.config.items.find((i) => i.id === id)?.text ?? '?')
        .join(' → ');
    }
    case 'NUMBER_GUESS': {
      const unit = question.config.unit ? ` ${question.config.unit}` : '';
      return `${(payload as AnswerPayloadMap['NUMBER_GUESS']).value}${unit}`;
    }
  }
}

/** Human-readable correct answer, shown on reveal and in results. */
export function describeCorrectAnswer(question: Question): string {
  switch (question.type) {
    case 'SINGLE_CHOICE':
    case 'IMAGE_CHOICE':
      return describeAnswer(question, { optionId: question.config.correctOptionId });
    case 'MULTIPLE_CHOICE':
      return describeAnswer(question, { optionIds: question.config.correctOptionIds });
    case 'TRUE_FALSE':
      return question.config.correct ? 'True' : 'False';
    case 'TYPE_ANSWER':
      return question.config.acceptedAnswers.join(' / ');
    case 'ORDERING':
      return question.config.items.map((i) => i.text).join(' → ');
    case 'NUMBER_GUESS': {
      const unit = question.config.unit ? ` ${question.config.unit}` : '';
      const tolerance = question.config.tolerance ? ` (±${question.config.tolerance})` : '';
      return `${question.config.correct}${unit}${tolerance}`;
    }
    case 'POLL':
      return 'No right answer, it was a poll!';
  }
}

export interface DistributionBucket {
  key: string;
  label: string;
  imageUrl?: string | null;
  count: number;
  correct: boolean;
}

/** Groups answers for the host's live bar chart. Free-form types are bucketed by right/wrong. */
export function answerDistribution(question: Question, payloads: AnswerPayload[]): DistributionBucket[] {
  const choiceBuckets = (correctIds: string[]): DistributionBucket[] =>
    'options' in question.config
      ? question.config.options.map((o, i) => ({
          key: o.id,
          label: o.text || `Picture ${i + 1}`,
          imageUrl: o.imageUrl ?? null,
          count: payloads.filter((p) => {
            const pick = p as Partial<AnswerPayloadMap['MULTIPLE_CHOICE'] & AnswerPayloadMap['SINGLE_CHOICE']>;
            return pick.optionId === o.id || (pick.optionIds ?? []).includes(o.id);
          }).length,
          correct: correctIds.includes(o.id),
        }))
      : [];

  switch (question.type) {
    case 'SINGLE_CHOICE':
    case 'IMAGE_CHOICE':
      return choiceBuckets([question.config.correctOptionId]);
    case 'MULTIPLE_CHOICE':
      return choiceBuckets(question.config.correctOptionIds);
    case 'POLL':
      return choiceBuckets([]);
    case 'TRUE_FALSE':
      return [true, false].map((value) => ({
        key: String(value),
        label: value ? 'True' : 'False',
        count: payloads.filter((p) => (p as AnswerPayloadMap['TRUE_FALSE']).value === value).length,
        correct: question.config.correct === value,
      }));
    default: {
      const right = payloads.filter((p) => gradeAnswer(question, p).isCorrect).length;
      return [
        { key: 'correct', label: 'Correct', count: right, correct: true },
        { key: 'wrong', label: 'Not quite', count: payloads.length - right, correct: false },
      ];
    }
  }
}

export interface ScoredPlayer {
  playerId: string;
  username: string;
  score: number;
  correctCount: number;
  answeredCount: number;
}

export type RankedPlayer = ScoredPlayer & { rank: number };

/** Sorts by score (then correct answers, then name) and gives tied players the same rank. */
export function rankPlayers(players: ScoredPlayer[]): RankedPlayer[] {
  const sorted = [...players].sort(
    (a, b) =>
      b.score - a.score || b.correctCount - a.correctCount || a.username.localeCompare(b.username),
  );
  let rank = 0;
  return sorted.map((p, i) => {
    const prev = sorted[i - 1];
    if (!prev || prev.score !== p.score) rank = i + 1;
    return { ...p, rank };
  });
}
