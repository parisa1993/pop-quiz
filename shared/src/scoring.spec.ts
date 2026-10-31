import { Question } from './question-types.js';
import {
  answerDistribution,
  describeAnswer,
  describeCorrectAnswer,
  gradeAnswer,
  isScored,
  normalizeText,
  rankPlayers,
  shuffleItems,
  toPublicQuestion,
} from './scoring.js';

const base = { id: 'q1', quizId: 'z', order: 0, text: 'Q?', imageUrl: null, points: 100 };
const options = [
  { id: 'a', text: 'Apple' },
  { id: 'b', text: 'Banana' },
  { id: 'c', text: 'Cherry' },
];

const single: Question = { ...base, type: 'SINGLE_CHOICE', config: { options, correctOptionId: 'b' } };
const multi: Question = {
  ...base,
  type: 'MULTIPLE_CHOICE',
  config: { options, correctOptionIds: ['a', 'c'] },
};
const trueFalse: Question = { ...base, type: 'TRUE_FALSE', config: { correct: false } };
const image: Question = {
  ...base,
  type: 'IMAGE_CHOICE',
  config: {
    options: [
      { id: 'x', text: '', imageUrl: '/u/x.png' },
      { id: 'y', text: 'Cake', imageUrl: '/u/y.png' },
    ],
    correctOptionId: 'x',
  },
};
const typed: Question = {
  ...base,
  type: 'TYPE_ANSWER',
  config: { acceptedAnswers: ['Crème Brûlée', 'creme brulee'] },
};
const ordering: Question = {
  ...base,
  type: 'ORDERING',
  config: {
    items: [
      { id: '1', text: 'One' },
      { id: '2', text: 'Two' },
      { id: '3', text: 'Three' },
    ],
  },
};
const number: Question = {
  ...base,
  type: 'NUMBER_GUESS',
  config: { correct: 30, tolerance: 2, unit: 'years' },
};
const poll: Question = { ...base, type: 'POLL', config: { options } };

describe('normalizeText', () => {
  it('ignores case, accents, punctuation and extra spaces', () => {
    expect(normalizeText('  Crème   BRÛLÉE!! ')).toBe('creme brulee');
  });
});

describe('gradeAnswer', () => {
  it('grades single choice', () => {
    expect(gradeAnswer(single, { optionId: 'b' })).toEqual({ isCorrect: true, points: 100 });
    expect(gradeAnswer(single, { optionId: 'a' })).toEqual({ isCorrect: false, points: 0 });
  });

  it('requires the exact set for multiple choice', () => {
    expect(gradeAnswer(multi, { optionIds: ['c', 'a'] }).isCorrect).toBe(true);
    expect(gradeAnswer(multi, { optionIds: ['a'] }).isCorrect).toBe(false);
    expect(gradeAnswer(multi, { optionIds: ['a', 'b', 'c'] }).isCorrect).toBe(false);
  });

  it('grades true/false', () => {
    expect(gradeAnswer(trueFalse, { value: false }).isCorrect).toBe(true);
    expect(gradeAnswer(trueFalse, { value: true }).isCorrect).toBe(false);
  });

  it('grades image choice', () => {
    expect(gradeAnswer(image, { optionId: 'x' }).isCorrect).toBe(true);
    expect(gradeAnswer(image, { optionId: 'y' }).isCorrect).toBe(false);
  });

  it('accepts typed answers loosely', () => {
    expect(gradeAnswer(typed, { text: 'creme brulee' }).isCorrect).toBe(true);
    expect(gradeAnswer(typed, { text: 'CRÈME brûlée.' }).isCorrect).toBe(true);
    expect(gradeAnswer(typed, { text: 'pudding' }).isCorrect).toBe(false);
  });

  it('requires the exact order', () => {
    expect(gradeAnswer(ordering, { itemIds: ['1', '2', '3'] }).isCorrect).toBe(true);
    expect(gradeAnswer(ordering, { itemIds: ['2', '1', '3'] }).isCorrect).toBe(false);
  });

  it('accepts numbers within tolerance', () => {
    expect(gradeAnswer(number, { value: 32 }).isCorrect).toBe(true);
    expect(gradeAnswer(number, { value: 28 }).isCorrect).toBe(true);
    expect(gradeAnswer(number, { value: 33 }).isCorrect).toBe(false);
  });

  it('never scores polls', () => {
    expect(gradeAnswer(poll, { optionId: 'a' })).toEqual({ isCorrect: false, points: 0 });
    expect(isScored(poll)).toBe(false);
    expect(isScored(single)).toBe(true);
  });
});

describe('shuffleItems', () => {
  it('is deterministic and never returns the solved order', () => {
    const first = shuffleItems(ordering.config.items as never, 'seed');
    const second = shuffleItems(ordering.config.items as never, 'seed');
    expect(first).toEqual(second);
    expect(first.map((i) => i.id)).not.toEqual(['1', '2', '3']);
    expect([...first.map((i) => i.id)].sort()).toEqual(['1', '2', '3']);
  });
});

describe('toPublicQuestion', () => {
  it('removes correct answers from every type', () => {
    for (const q of [single, multi, trueFalse, image, typed, ordering, number, poll]) {
      const json = JSON.stringify(toPublicQuestion(q).config);
      expect(json).not.toMatch(/correct|accepted|tolerance/);
    }
  });

  it('keeps what players need to answer', () => {
    expect(toPublicQuestion(multi).config).toEqual({ options, multiple: true });
    expect(toPublicQuestion(number).config).toEqual({ unit: 'years' });
    expect(toPublicQuestion(ordering).config.items).toHaveLength(3);
  });
});

describe('describeAnswer / describeCorrectAnswer', () => {
  it('renders readable answers', () => {
    expect(describeAnswer(single, { optionId: 'a' })).toBe('Apple');
    expect(describeAnswer(multi, { optionIds: ['a', 'c'] })).toBe('Apple, Cherry');
    expect(describeAnswer(image, { optionId: 'x' })).toBe('Picture 1');
    expect(describeAnswer(ordering, { itemIds: ['3', '1', '2'] })).toBe('Three → One → Two');
    expect(describeAnswer(number, { value: 31 })).toBe('31 years');
    expect(describeAnswer(trueFalse, { value: true })).toBe('True');
    expect(describeAnswer(single, null)).toBe('—');
  });

  it('renders correct answers', () => {
    expect(describeCorrectAnswer(single)).toBe('Banana');
    expect(describeCorrectAnswer(multi)).toBe('Apple, Cherry');
    expect(describeCorrectAnswer(typed)).toBe('Crème Brûlée / creme brulee');
    expect(describeCorrectAnswer(number)).toBe('30 years (±2)');
    expect(describeCorrectAnswer(trueFalse)).toBe('False');
    expect(describeCorrectAnswer(poll)).toMatch(/poll/);
  });
});

describe('answerDistribution', () => {
  it('counts choice answers per option', () => {
    const buckets = answerDistribution(single, [{ optionId: 'b' }, { optionId: 'b' }, { optionId: 'a' }]);
    expect(buckets.map((b) => [b.key, b.count, b.correct])).toEqual([
      ['a', 1, false],
      ['b', 2, true],
      ['c', 0, false],
    ]);
  });

  it('counts multi-select picks', () => {
    const buckets = answerDistribution(multi, [{ optionIds: ['a', 'b'] }, { optionIds: ['a'] }]);
    expect(buckets.find((b) => b.key === 'a')?.count).toBe(2);
  });

  it('splits true/false', () => {
    const buckets = answerDistribution(trueFalse, [{ value: true }, { value: false }, { value: false }]);
    expect(buckets).toEqual([
      { key: 'true', label: 'True', count: 1, correct: false },
      { key: 'false', label: 'False', count: 2, correct: true },
    ]);
  });

  it('buckets free-form answers by right/wrong', () => {
    const buckets = answerDistribution(number, [{ value: 30 }, { value: 50 }]);
    expect(buckets.map((b) => b.count)).toEqual([1, 1]);
  });
});

describe('rankPlayers', () => {
  it('sorts by score and shares ranks on ties', () => {
    const ranked = rankPlayers([
      { playerId: '1', username: 'Bo', score: 100, correctCount: 1, answeredCount: 2 },
      { playerId: '2', username: 'Al', score: 300, correctCount: 3, answeredCount: 3 },
      { playerId: '3', username: 'Cy', score: 100, correctCount: 1, answeredCount: 3 },
    ]);
    expect(ranked.map((p) => [p.username, p.rank])).toEqual([
      ['Al', 1],
      ['Bo', 2],
      ['Cy', 2],
    ]);
  });
});
