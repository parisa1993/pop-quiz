import { Question, QUESTION_TYPES } from './question-types.js';
import {
  createDefaultConfig,
  isValidAnswerPayload,
  newId,
  validateQuestionInput,
} from './question-validation.js';

const opts = [
  { id: 'a', text: 'A' },
  { id: 'b', text: 'B' },
];

describe('validateQuestionInput', () => {
  it('rejects non-objects and unknown types', () => {
    expect(validateQuestionInput(null)).toEqual({ valid: false, errors: ['Question is required'] });
    expect(validateQuestionInput({ type: 'NOPE' })).toEqual({
      valid: false,
      errors: ['Pick a question type'],
    });
  });

  it('accepts and normalizes a valid single choice', () => {
    const result = validateQuestionInput({
      type: 'SINGLE_CHOICE',
      text: '  Favourite cake?  ',
      config: { options: opts, correctOptionId: 'a' },
    });
    expect(result).toEqual({
      valid: true,
      value: {
        type: 'SINGLE_CHOICE',
        text: 'Favourite cake?',
        imageUrl: null,
        points: 100,
        config: {
          options: [
            { id: 'a', text: 'A', imageUrl: null },
            { id: 'b', text: 'B', imageUrl: null },
          ],
          correctOptionId: 'a',
        },
      },
    });
  });

  it('reports missing text, bad points and missing correct answer', () => {
    const result = validateQuestionInput({
      type: 'SINGLE_CHOICE',
      text: '',
      points: -5,
      config: { options: opts, correctOptionId: 'zzz' },
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toEqual(
        expect.arrayContaining([
          'Write the question',
          'Points must be a whole number between 0 and 10000',
          'Mark the correct answer',
        ]),
      );
    }
  });

  it('enforces option counts, unique ids and text', () => {
    const result = validateQuestionInput({
      type: 'POLL',
      text: 'Q',
      config: { options: [{ id: 'a', text: '' }] },
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toContain('Add between 2 and 6 options');
      expect(result.errors).toContain('Option 1 needs text');
    }
    const dupes = validateQuestionInput({
      type: 'POLL',
      text: 'Q',
      config: {
        options: [
          { id: 'a', text: 'x' },
          { id: 'a', text: 'y' },
        ],
      },
    });
    expect(dupes.valid).toBe(false);
  });

  it('requires pictures for image choice', () => {
    const result = validateQuestionInput({
      type: 'IMAGE_CHOICE',
      text: 'Which?',
      config: { options: opts, correctOptionId: 'a' },
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors).toContain('Option 1 needs a picture');
  });

  it('validates multiple choice correct ids', () => {
    expect(
      validateQuestionInput({
        type: 'MULTIPLE_CHOICE',
        text: 'Q',
        config: { options: opts, correctOptionIds: [] },
      }).valid,
    ).toBe(false);
    expect(
      validateQuestionInput({
        type: 'MULTIPLE_CHOICE',
        text: 'Q',
        config: { options: opts, correctOptionIds: ['a', 'b', 'a'] },
      }),
    ).toMatchObject({ valid: true, value: { config: { correctOptionIds: ['a', 'b'] } } });
  });

  it('validates true/false, typed, ordering and number configs', () => {
    expect(validateQuestionInput({ type: 'TRUE_FALSE', text: 'Q', config: {} }).valid).toBe(false);
    expect(
      validateQuestionInput({ type: 'TRUE_FALSE', text: 'Q', config: { correct: false } }).valid,
    ).toBe(true);
    expect(
      validateQuestionInput({
        type: 'TYPE_ANSWER',
        text: 'Q',
        config: { acceptedAnswers: [' ', ''] },
      }).valid,
    ).toBe(false);
    expect(
      validateQuestionInput({
        type: 'ORDERING',
        text: 'Q',
        config: {
          items: [
            { id: '1', text: 'a' },
            { id: '2', text: 'b' },
          ],
        },
      }).valid,
    ).toBe(false);
    expect(
      validateQuestionInput({
        type: 'NUMBER_GUESS',
        text: 'Q',
        config: { correct: 'x', tolerance: -1 },
      }),
    ).toEqual({
      valid: false,
      errors: ['Enter the correct number', 'Tolerance must be 0 or more'],
    });
    expect(
      validateQuestionInput({
        type: 'NUMBER_GUESS',
        text: 'Q',
        config: { correct: 7, unit: ' kg ' },
      }),
    ).toMatchObject({ valid: true, value: { config: { correct: 7, tolerance: 0, unit: 'kg' } } });
  });
});

describe('isValidAnswerPayload', () => {
  const base = { id: 'q', quizId: 'z', order: 0, text: 'Q', points: 100 };
  const single: Question = {
    ...base,
    type: 'SINGLE_CHOICE',
    config: { options: opts, correctOptionId: 'a' },
  };
  const multi: Question = {
    ...base,
    type: 'MULTIPLE_CHOICE',
    config: { options: opts, correctOptionIds: ['a'] },
  };
  const ordering: Question = {
    ...base,
    type: 'ORDERING',
    config: {
      items: [
        { id: '1', text: 'a' },
        { id: '2', text: 'b' },
        { id: '3', text: 'c' },
      ],
    },
  };

  it('checks option ids exist', () => {
    expect(isValidAnswerPayload(single, { optionId: 'a' })).toBe(true);
    expect(isValidAnswerPayload(single, { optionId: 'nope' })).toBe(false);
    expect(isValidAnswerPayload(single, 'a')).toBe(false);
  });

  it('checks multi-select picks', () => {
    expect(isValidAnswerPayload(multi, { optionIds: ['a', 'b'] })).toBe(true);
    expect(isValidAnswerPayload(multi, { optionIds: [] })).toBe(false);
    expect(isValidAnswerPayload(multi, { optionIds: ['a', 'a'] })).toBe(false);
  });

  it('requires every ordering item exactly once', () => {
    expect(isValidAnswerPayload(ordering, { itemIds: ['3', '1', '2'] })).toBe(true);
    expect(isValidAnswerPayload(ordering, { itemIds: ['1', '1', '2'] })).toBe(false);
  });

  it('checks primitive payloads', () => {
    expect(
      isValidAnswerPayload(
        { ...base, type: 'TRUE_FALSE', config: { correct: true } },
        { value: 'yes' },
      ),
    ).toBe(false);
    expect(
      isValidAnswerPayload(
        { ...base, type: 'TYPE_ANSWER', config: { acceptedAnswers: ['x'] } },
        { text: 'hi' },
      ),
    ).toBe(true);
    expect(
      isValidAnswerPayload(
        { ...base, type: 'NUMBER_GUESS', config: { correct: 1, tolerance: 0 } },
        { value: Number.NaN },
      ),
    ).toBe(false);
  });
});

describe('createDefaultConfig', () => {
  it('creates a config for every type', () => {
    for (const type of QUESTION_TYPES) expect(createDefaultConfig(type)).toBeTruthy();
    const single = createDefaultConfig('SINGLE_CHOICE');
    expect(single.options).toHaveLength(4);
    expect(single.correctOptionId).toBe(single.options[0].id);
  });

  it('generates unique ids', () => {
    const ids = new Set(Array.from({ length: 200 }, newId));
    expect(ids.size).toBe(200);
  });
});
