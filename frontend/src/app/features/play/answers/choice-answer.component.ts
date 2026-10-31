import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output } from '@angular/core';
import type { AnswerPayload, ChoiceOption, PublicQuestion } from '@pop-quiz/shared';
import { answerStyle } from '../../../shared/answer-style';

const TRUE_FALSE: ChoiceOption[] = [
  { id: 'true', text: 'True' },
  { id: 'false', text: 'False' },
];

/** Tiles for single choice, multi-select, true/false, picture answers and polls. */
@Component({
  selector: 'app-choice-answer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tiles" [class.tiles--images]="isImage()" role="group" [attr.aria-label]="multiple() ? 'Pick all that apply' : 'Pick one'">
      @for (option of options(); track option.id; let i = $index) {
        <button
          type="button"
          class="tile"
          [class.is-picked]="picked().includes(option.id)"
          [class.is-dimmed]="locked() && !picked().includes(option.id)"
          [style.--tile]="style(i).color"
          [disabled]="locked()"
          [attr.aria-pressed]="picked().includes(option.id)"
          (click)="tap(option.id)"
        >
          @if (option.imageUrl) {
            <img [src]="option.imageUrl" [alt]="option.text || 'Picture ' + (i + 1)" class="tile__img" />
          }
          <span class="tile__label">
            <span class="shape" aria-hidden="true">{{ style(i).shape }}</span>
            <span>{{ option.text || 'Picture ' + (i + 1) }}</span>
            @if (multiple() && !locked()) {
              <span class="tile__check" aria-hidden="true">{{ picked().includes(option.id) ? '✔' : '' }}</span>
            }
          </span>
        </button>
      }
    </div>
    @if (multiple() && !locked()) {
      <button type="button" class="btn btn--yellow btn--lg btn--block submit" [disabled]="picked().length === 0" (click)="submitMany()">
        Lock in {{ picked().length || '' }} answer{{ picked().length === 1 ? '' : 's' }} 🔒
      </button>
    }
  `,
  styles: `
    .tiles {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 160px), 1fr));
      gap: var(--space-3);
    }
    .tiles--images { grid-template-columns: repeat(2, 1fr); }
    .tile {
      position: relative;
      min-height: 84px;
      display: grid;
      align-content: end;
      padding: 0;
      overflow: hidden;
      border: 0;
      border-radius: var(--radius-m);
      background: var(--tile);
      color: #fff;
      font-family: var(--font-display);
      font-size: var(--fs-l);
      font-weight: 600;
      text-align: left;
      cursor: pointer;
      box-shadow: inset 0 -6px 0 rgba(0, 0, 0, 0.18);
      transition: transform var(--dur) var(--ease-bounce), opacity var(--dur), filter var(--dur);
    }
    .tile:active:not(:disabled) { transform: scale(0.96); }
    .tile:disabled { cursor: default; }
    .tile__img { width: 100%; aspect-ratio: 1; object-fit: cover; background: #fff; }
    .tile__label { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3); }
    .tile__check { margin-left: auto; width: 28px; height: 28px; border-radius: 8px; border: 3px solid #fff; display: grid; place-items: center; font-size: 1rem; }
    .is-picked { outline: 4px solid #fff; outline-offset: -4px; transform: scale(1.02); }
    .is-dimmed { opacity: 0.35; filter: saturate(0.4); }
    .submit { margin-top: var(--space-4); }
  `,
})
export class ChoiceAnswerComponent {
  readonly question = input.required<PublicQuestion>();
  readonly answer = input<AnswerPayload | null>(null);
  readonly locked = input(false);
  readonly submitted = output<AnswerPayload>();

  protected readonly style = answerStyle;
  protected readonly isImage = computed(() => this.question().type === 'IMAGE_CHOICE');
  protected readonly multiple = computed(() => this.question().type === 'MULTIPLE_CHOICE');
  protected readonly options = computed(() =>
    this.question().type === 'TRUE_FALSE' ? TRUE_FALSE : (this.question().config.options ?? []),
  );

  /** Shows what the player picked, from local taps or from the saved answer. */
  protected readonly picked = linkedSignal<string[]>(() => {
    const answer = this.answer() as Record<string, unknown> | null;
    if (!answer) return [];
    if (Array.isArray(answer['optionIds'])) return answer['optionIds'] as string[];
    if (typeof answer['optionId'] === 'string') return [answer['optionId']];
    if (typeof answer['value'] === 'boolean') return [String(answer['value'])];
    return [];
  });

  protected tap(id: string): void {
    if (this.locked()) return;
    if (this.multiple()) {
      this.picked.update((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
      return;
    }
    this.picked.set([id]);
    this.submitted.emit(this.question().type === 'TRUE_FALSE' ? { value: id === 'true' } : { optionId: id });
  }

  protected submitMany(): void {
    if (this.picked().length) this.submitted.emit({ optionIds: this.picked() });
  }
}
