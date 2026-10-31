import { ANSWER_STYLES, answerStyle, rankLabel } from './answer-style';

describe('answer styles', () => {
  it('cycles colours and shapes', () => {
    expect(answerStyle(0)).toBe(ANSWER_STYLES[0]);
    expect(answerStyle(ANSWER_STYLES.length)).toBe(ANSWER_STYLES[0]);
    expect(answerStyle(-1)).toBe(ANSWER_STYLES[ANSWER_STYLES.length - 1]);
  });

  it('labels ranks with medals', () => {
    expect(rankLabel(1)).toBe('🥇');
    expect(rankLabel(3)).toBe('🥉');
    expect(rankLabel(4)).toBe('#4');
  });
});
