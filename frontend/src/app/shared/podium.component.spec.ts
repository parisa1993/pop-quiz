import { TestBed } from '@angular/core/testing';
import type { RankedPlayer } from '@pop-quiz/shared';
import { PodiumComponent } from './podium.component';

const player = (rank: number, username: string): RankedPlayer => ({
  playerId: username,
  username,
  rank,
  score: 100 * (4 - rank),
  correctCount: 0,
  answeredCount: 0,
});

describe('PodiumComponent', () => {
  it('orders steps 2-1-3 and highlights me', async () => {
    const fixture = TestBed.createComponent(PodiumComponent);
    fixture.componentRef.setInput('players', [player(1, 'Ana'), player(2, 'Ben'), player(3, 'Cy')]);
    fixture.componentRef.setInput('highlightId', 'Ben');
    await fixture.whenStable();
    const names = [...fixture.nativeElement.querySelectorAll('.podium__name')].map(
      (n: Element) => n.textContent,
    );
    expect(names).toEqual(['Ben', 'Ana', 'Cy']);
    expect(fixture.nativeElement.querySelector('.is-me .podium__name').textContent).toBe('Ben');
  });

  it('handles fewer than three players', async () => {
    const fixture = TestBed.createComponent(PodiumComponent);
    fixture.componentRef.setInput('players', [player(1, 'Solo')]);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('.podium__step')).toHaveLength(1);
  });
});
