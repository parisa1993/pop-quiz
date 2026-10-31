/** Colour + shape for answer tile N, so options stay recognisable on every screen. */
export const ANSWER_STYLES = [
  { color: 'var(--c-answer-1)', shape: '▲' },
  { color: 'var(--c-answer-2)', shape: '◆' },
  { color: 'var(--c-answer-3)', shape: '●' },
  { color: 'var(--c-answer-4)', shape: '■' },
  { color: 'var(--c-answer-5)', shape: '★' },
  { color: 'var(--c-answer-6)', shape: '⬟' },
] as const;

export function answerStyle(index: number): (typeof ANSWER_STYLES)[number] {
  return ANSWER_STYLES[
    ((index % ANSWER_STYLES.length) + ANSWER_STYLES.length) % ANSWER_STYLES.length
  ];
}

export const MEDALS = ['🥇', '🥈', '🥉'];

export function rankLabel(rank: number): string {
  return MEDALS[rank - 1] ?? `#${rank}`;
}
