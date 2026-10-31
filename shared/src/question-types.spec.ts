import { isQuestionType, QUESTION_TYPE_INFO, QUESTION_TYPES } from './question-types.js';

describe('question types', () => {
  it('recognises known types only', () => {
    expect(isQuestionType('TRUE_FALSE')).toBe(true);
    expect(isQuestionType('true_false')).toBe(false);
    expect(isQuestionType(42)).toBe(false);
  });

  it('has display info for every type', () => {
    for (const type of QUESTION_TYPES) {
      expect(QUESTION_TYPE_INFO[type].label).toBeTruthy();
      expect(QUESTION_TYPE_INFO[type].icon).toBeTruthy();
    }
  });
});
