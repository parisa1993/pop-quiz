import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { RankedPlayer } from '@pop-quiz/shared';
import { rankLabel } from './answer-style';

/** Top-3 podium: 2nd, 1st, 3rd from left to right, like a real one. */
@Component({
  selector: 'app-podium',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="podium" aria-label="Top players">
      @for (entry of arranged(); track entry.player.playerId) {
        <li
          class="podium__step podium__step--{{ entry.place }}"
          [class.is-me]="entry.player.playerId === highlightId()"
        >
          <span class="podium__medal" aria-hidden="true">{{ label(entry.player.rank) }}</span>
          <span class="podium__name">{{ entry.player.username }}</span>
          <span class="podium__score">{{ entry.player.score }} pts</span>
          <span class="podium__block"
            ><span class="visually-hidden">Rank</span>{{ entry.player.rank }}</span
          >
        </li>
      }
    </ol>
  `,
  styles: `
    .podium {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      gap: var(--space-2);
    }
    .podium__step {
      flex: 1 1 0;
      max-width: 160px;
      display: grid;
      justify-items: center;
      gap: 2px;
      text-align: center;
      animation: pop-in 500ms var(--ease-bounce) both;
    }
    .podium__step--1 {
      animation-delay: 300ms;
    }
    .podium__step--3 {
      animation-delay: 150ms;
    }
    .podium__medal {
      font-size: 2rem;
    }
    .podium__name {
      font-family: var(--font-display);
      font-weight: 600;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .podium__score {
      font-size: var(--fs-s);
      opacity: 0.85;
      font-weight: 700;
    }
    .podium__block {
      width: 100%;
      display: grid;
      place-items: center;
      margin-top: var(--space-2);
      border-radius: var(--radius-m) var(--radius-m) 0 0;
      font-family: var(--font-display);
      font-size: var(--fs-xl);
      font-weight: 700;
      color: #fff;
      background: var(--c-primary);
      box-shadow: inset 0 -8px 0 rgba(0, 0, 0, 0.12);
    }
    .podium__step--1 .podium__block {
      height: 120px;
      background: var(--c-yellow);
      color: var(--c-ink);
    }
    .podium__step--2 .podium__block {
      height: 88px;
      background: var(--c-blue);
    }
    .podium__step--3 .podium__block {
      height: 64px;
      background: var(--c-pink);
    }
    .is-me .podium__name {
      text-decoration: underline wavy var(--c-yellow);
    }
  `,
})
export class PodiumComponent {
  readonly players = input.required<RankedPlayer[]>();
  readonly highlightId = input<string | null>(null);
  protected readonly label = rankLabel;

  protected readonly arranged = computed(() => {
    const [first, second, third] = this.players();
    return [
      second && { player: second, place: 2 },
      first && { player: first, place: 1 },
      third && { player: third, place: 3 },
    ].filter((e): e is { player: RankedPlayer; place: number } => !!e);
  });
}
