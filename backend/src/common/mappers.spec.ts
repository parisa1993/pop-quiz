import { toIso, toQuestion } from './mappers.js';

describe('mappers', () => {
  it('maps a question row to the shared shape', () => {
    const row = {
      id: 'q',
      quizId: 'z',
      order: 2,
      type: 'TRUE_FALSE',
      text: 'Sky is blue',
      imageUrl: null,
      points: 50,
      config: { correct: true },
    };
    expect(toQuestion(row)).toEqual(row);
  });

  it('formats dates', () => {
    expect(toIso(new Date('2026-01-02T03:04:05.000Z'))).toBe('2026-01-02T03:04:05.000Z');
    expect(toIso(null)).toBeNull();
  });
});
