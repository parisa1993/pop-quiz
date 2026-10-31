import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import type { AnswerPayload, PublicQuestion } from '@pop-quiz/shared';

/** Typed answers: free text (TYPE_ANSWER) or a number (NUMBER_GUESS). */
@Component({
  selector: 'app-free-answer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="free" (submit)="submit($event)">
      <label class="visually-hidden" for="free-answer">{{
        isNumber() ? 'Your guess' : 'Your answer'
      }}</label>
      <div class="free__row">
        <input
          id="free-answer"
          class="input input--xl"
          [attr.type]="isNumber() ? 'number' : 'text'"
          [attr.inputmode]="isNumber() ? 'decimal' : 'text'"
          [attr.step]="isNumber() ? 'any' : null"
          [value]="value()"
          (input)="value.set($any($event.target).value)"
          [disabled]="locked()"
          [placeholder]="isNumber() ? 'Your guess' : 'Type your answer'"
          maxlength="200"
          autocomplete="off"
          enterkeyhint="send"
        />
        @if (unit()) {
          <span class="free__unit">{{ unit() }}</span>
        }
      </div>
      @if (!locked()) {
        <button class="btn btn--yellow btn--lg btn--block" [disabled]="!valid()">
          Lock it in 🔒
        </button>
      }
    </form>
  `,
  styles: `
    .free {
      display: grid;
      gap: var(--space-4);
    }
    .free__row {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }
    .free__unit {
      font-weight: 800;
      color: var(--c-ink-soft);
    }
    .input:disabled {
      background: var(--c-surface-2);
    }
  `,
})
export class FreeAnswerComponent {
  readonly question = input.required<PublicQuestion>();
  readonly answer = input<AnswerPayload | null>(null);
  readonly locked = input(false);
  readonly submitted = output<AnswerPayload>();

  protected readonly isNumber = computed(() => this.question().type === 'NUMBER_GUESS');
  protected readonly unit = computed(() => this.question().config.unit ?? null);
  protected readonly value = linkedSignal(() => {
    const answer = this.answer() as { text?: string; value?: number } | null;
    return answer?.text ?? (answer?.value !== undefined ? String(answer.value) : '');
  });
  protected readonly valid = computed(() => {
    const raw = this.value().trim();
    return this.isNumber() ? raw !== '' && Number.isFinite(Number(raw)) : raw.length > 0;
  });

  protected submit(event: Event): void {
    event.preventDefault();
    if (!this.valid() || this.locked()) return;
    const raw = this.value().trim();
    this.submitted.emit(this.isNumber() ? { value: Number(raw) } : { text: raw });
  }
}
