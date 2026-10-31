import {
  AnswerPayload,
  ChoiceOption,
  DEFAULT_POINTS,
  isQuestionType,
  MAX_OPTIONS,
  MAX_ORDER_ITEMS,
  MIN_OPTIONS,
  MIN_ORDER_ITEMS,
  OrderItem,
  Question,
  QuestionConfigMap,
  QuestionInput,
  QuestionType,
} from './question-types.js';

export type ValidationResult =
  { valid: true; value: QuestionInput } | { valid: false; errors: string[] };

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function checkUniqueIds(items: { id: string }[], label: string, errors: string[]): void {
  const ids = new Set(items.map((i) => i.id));
  if (ids.size !== items.length) errors.push(`${label} must have unique ids`);
}

function readOptions(raw: unknown, errors: string[], requireImage: boolean): ChoiceOption[] {
  if (!Array.isArray(raw)) {
    errors.push('Options are required');
    return [];
  }
  if (raw.length < MIN_OPTIONS || raw.length > MAX_OPTIONS) {
    errors.push(`Add between ${MIN_OPTIONS} and ${MAX_OPTIONS} options`);
  }
  const options = raw.map((o, i): ChoiceOption => {
    if (!isObject(o) || !isNonEmptyString(o['id'])) {
      errors.push(`Option ${i + 1} is invalid`);
      return { id: '', text: '' };
    }
    const text = typeof o['text'] === 'string' ? o['text'].trim() : '';
    const imageUrl = isNonEmptyString(o['imageUrl']) ? o['imageUrl'] : null;
    if (requireImage && !imageUrl) errors.push(`Option ${i + 1} needs a picture`);
    if (!requireImage && !text) errors.push(`Option ${i + 1} needs text`);
    return { id: o['id'], text, imageUrl };
  });
  checkUniqueIds(options, 'Options', errors);
  return options;
}

function readItems(raw: unknown, errors: string[]): OrderItem[] {
  if (!Array.isArray(raw)) {
    errors.push('Items are required');
    return [];
  }
  if (raw.length < MIN_ORDER_ITEMS || raw.length > MAX_ORDER_ITEMS) {
    errors.push(`Add between ${MIN_ORDER_ITEMS} and ${MAX_ORDER_ITEMS} items`);
  }
  const items = raw.map((o, i): OrderItem => {
    if (!isObject(o) || !isNonEmptyString(o['id']) || !isNonEmptyString(o['text'])) {
      errors.push(`Item ${i + 1} needs text`);
      return { id: '', text: '' };
    }
    return { id: o['id'], text: o['text'].trim() };
  });
  checkUniqueIds(items, 'Items', errors);
  return items;
}

function readConfig(
  type: QuestionType,
  raw: unknown,
  errors: string[],
): QuestionConfigMap[QuestionType] {
  const c = isObject(raw) ? raw : {};
  switch (type) {
    case 'SINGLE_CHOICE':
    case 'IMAGE_CHOICE': {
      const options = readOptions(c['options'], errors, type === 'IMAGE_CHOICE');
      const correctOptionId = c['correctOptionId'];
      if (!isNonEmptyString(correctOptionId) || !options.some((o) => o.id === correctOptionId)) {
        errors.push('Mark the correct answer');
      }
      return { options, correctOptionId: String(correctOptionId ?? '') };
    }
    case 'MULTIPLE_CHOICE': {
      const options = readOptions(c['options'], errors, false);
      const raw = c['correctOptionIds'];
      const correctOptionIds = Array.isArray(raw) ? raw.filter(isNonEmptyString) : [];
      if (correctOptionIds.length === 0) errors.push('Mark at least one correct answer');
      if (correctOptionIds.some((id) => !options.some((o) => o.id === id))) {
        errors.push('Correct answers must be one of the options');
      }
      return { options, correctOptionIds: [...new Set(correctOptionIds)] };
    }
    case 'TRUE_FALSE':
      if (typeof c['correct'] !== 'boolean')
        errors.push('Choose whether the statement is true or false');
      return { correct: c['correct'] === true };
    case 'TYPE_ANSWER': {
      const raw = c['acceptedAnswers'];
      const acceptedAnswers = Array.isArray(raw)
        ? raw.filter(isNonEmptyString).map((s) => s.trim())
        : [];
      if (acceptedAnswers.length === 0) errors.push('Add at least one accepted answer');
      return { acceptedAnswers };
    }
    case 'ORDERING':
      return { items: readItems(c['items'], errors) };
    case 'NUMBER_GUESS': {
      if (!isFiniteNumber(c['correct'])) errors.push('Enter the correct number');
      const tolerance = c['tolerance'] ?? 0;
      if (!isFiniteNumber(tolerance) || tolerance < 0) errors.push('Tolerance must be 0 or more');
      return {
        correct: Number(c['correct']),
        tolerance: Number(tolerance),
        unit: isNonEmptyString(c['unit']) ? c['unit'].trim() : null,
      };
    }
    case 'POLL':
      return { options: readOptions(c['options'], errors, false) };
  }
}

/** Validates and normalizes question input coming from the admin UI or API. */
export function validateQuestionInput(input: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isObject(input)) return { valid: false, errors: ['Question is required'] };

  const type = input['type'];
  if (!isQuestionType(type)) return { valid: false, errors: ['Pick a question type'] };

  const text = typeof input['text'] === 'string' ? input['text'].trim() : '';
  if (!text) errors.push('Write the question');
  if (text.length > 500) errors.push('Question is too long (max 500 characters)');

  const points = input['points'] ?? DEFAULT_POINTS;
  if (!isFiniteNumber(points) || points < 0 || points > 10000 || !Number.isInteger(points)) {
    errors.push('Points must be a whole number between 0 and 10000');
  }

  const imageUrl = isNonEmptyString(input['imageUrl']) ? input['imageUrl'] : null;
  const config = readConfig(type, input['config'], errors);

  if (errors.length) return { valid: false, errors };
  return {
    valid: true,
    value: { type, text, imageUrl, points: Number(points), config } as QuestionInput,
  };
}

/** Checks a gamer's answer has the right shape for the question. */
export function isValidAnswerPayload(
  question: Question,
  payload: unknown,
): payload is AnswerPayload {
  if (!isObject(payload)) return false;
  switch (question.type) {
    case 'SINGLE_CHOICE':
    case 'IMAGE_CHOICE':
    case 'POLL':
      return (
        isNonEmptyString(payload['optionId']) &&
        question.config.options.some((o) => o.id === payload['optionId'])
      );
    case 'MULTIPLE_CHOICE': {
      const ids = payload['optionIds'];
      return (
        Array.isArray(ids) &&
        ids.length > 0 &&
        new Set(ids).size === ids.length &&
        ids.every((id) => question.config.options.some((o) => o.id === id))
      );
    }
    case 'TRUE_FALSE':
      return typeof payload['value'] === 'boolean';
    case 'TYPE_ANSWER':
      return isNonEmptyString(payload['text']) && payload['text'].length <= 200;
    case 'ORDERING': {
      const ids = payload['itemIds'];
      const expected = question.config.items.map((i) => i.id);
      return (
        Array.isArray(ids) &&
        ids.length === expected.length &&
        [...ids].sort().join('|') === [...expected].sort().join('|')
      );
    }
    case 'NUMBER_GUESS':
      return isFiniteNumber(payload['value']);
  }
}

/** A sensible starting config so the admin editor never shows an empty question. */
export function createDefaultConfig<T extends QuestionType>(type: T): QuestionConfigMap[T] {
  const option = (text = ''): ChoiceOption => ({ id: newId(), text, imageUrl: null });
  const configs: { [K in QuestionType]: () => QuestionConfigMap[K] } = {
    SINGLE_CHOICE: () => {
      const options = [option(), option(), option(), option()];
      return { options, correctOptionId: options[0].id };
    },
    MULTIPLE_CHOICE: () => {
      const options = [option(), option(), option(), option()];
      return { options, correctOptionIds: [options[0].id] };
    },
    TRUE_FALSE: () => ({ correct: true }),
    IMAGE_CHOICE: () => {
      const options = [option(), option()];
      return { options, correctOptionId: options[0].id };
    },
    TYPE_ANSWER: () => ({ acceptedAnswers: [''] }),
    ORDERING: () => ({
      items: [1, 2, 3].map(() => ({ id: newId(), text: '' })),
    }),
    NUMBER_GUESS: () => ({ correct: 0, tolerance: 0, unit: null }),
    POLL: () => ({ options: [option(), option()] }),
  };
  return configs[type]() as QuestionConfigMap[T];
}
