import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ChoiceOption, MAX_OPTIONS, MIN_OPTIONS, newId } from '@pop-quiz/shared';
import { answerStyle } from '../../../shared/answer-style';
import { ImageUploadComponent } from '../../../shared/image-upload.component';

export type CorrectMode = 'single' | 'multi' | 'none';

export interface ChoiceChange {
  options: ChoiceOption[];
  correctIds: string[];
}

/** Edits answer options and which ones are correct, for every choice-based question type. */
@Component({
  selector: 'app-choice-options-editor',
  imports: [ImageUploadComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="hint">
      @switch (mode()) {
        @case ('single') { Tap the circle next to the <b>one</b> correct answer. }
        @case ('multi') { Tick <b>every</b> correct answer. }
        @default { Polls have no right answer. }
      }
    </p>
    <ul class="options" [class.options--images]="images()">
      @for (option of options(); track option.id; let i = $index) {
        <li class="option" [style.--tile]="style(i).color" [class.is-correct]="correctIds().includes(option.id)">
          <span class="shape option__shape" aria-hidden="true">{{ style(i).shape }}</span>
          @if (images()) {
            <app-image-upload class="option__img" [compact]="true" [url]="option.imageUrl" label="Add picture" (changed)="setImage(i, $event)" />
          }
          <input
            class="input option__text"
            [value]="option.text"
            (input)="setText(i, $any($event.target).value)"
            [placeholder]="images() ? 'Label (optional)' : 'Answer ' + (i + 1)"
            [attr.aria-label]="'Answer ' + (i + 1)"
            maxlength="120"
          />
          @if (mode() !== 'none') {
            <label class="option__correct">
              <input
                [type]="mode() === 'single' ? 'radio' : 'checkbox'"
                name="correct"
                [checked]="correctIds().includes(option.id)"
                (change)="toggleCorrect(option.id)"
              />
              <span>Correct</span>
            </label>
          }
          <button type="button" class="icon-btn" (click)="remove(i)" [disabled]="options().length <= minOptions" [attr.aria-label]="'Remove answer ' + (i + 1)">
            ✕
          </button>
        </li>
      }
    </ul>
    @if (options().length < maxOptions) {
      <button type="button" class="btn btn--soft" (click)="add()">＋ Add answer</button>
    }
  `,
  styles: `
    .hint { color: var(--c-ink-soft); font-size: var(--fs-s); }
    .options { list-style: none; margin: 0 0 var(--space-3); padding: 0; display: grid; gap: var(--space-2); }
    .options--images { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
    .option {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2);
      border-radius: var(--radius-m);
      border: 3px solid transparent;
      background: var(--c-surface-2);
    }
    .option.is-correct { border-color: var(--c-teal); background: #e7faf5; }
    .option__shape { background: var(--tile); color: #fff; }
    .option__text { flex: 1 1 140px; min-height: 44px; }
    .options--images .option { flex-direction: column; align-items: stretch; }
    .options--images .option__shape { align-self: flex-start; }
    .option__img { width: 100%; }
    .option__correct { display: inline-flex; align-items: center; gap: var(--space-1); font-weight: 800; font-size: var(--fs-s); color: #08765f; cursor: pointer; }
    .option__correct input { width: 22px; height: 22px; accent-color: var(--c-teal); }
  `,
})
export class ChoiceOptionsEditorComponent {
  readonly options = input.required<ChoiceOption[]>();
  readonly correctIds = input<string[]>([]);
  readonly mode = input<CorrectMode>('single');
  readonly images = input(false);
  readonly changed = output<ChoiceChange>();

  protected readonly style = answerStyle;
  protected readonly minOptions = MIN_OPTIONS;
  protected readonly maxOptions = MAX_OPTIONS;

  protected setText(index: number, text: string): void {
    this.emit(this.options().map((o, i) => (i === index ? { ...o, text } : o)));
  }

  protected setImage(index: number, imageUrl: string | null): void {
    this.emit(this.options().map((o, i) => (i === index ? { ...o, imageUrl } : o)));
  }

  protected toggleCorrect(id: string): void {
    const current = this.correctIds();
    const correctIds =
      this.mode() === 'single' ? [id] : current.includes(id) ? current.filter((c) => c !== id) : [...current, id];
    this.changed.emit({ options: this.options(), correctIds });
  }

  protected add(): void {
    this.emit([...this.options(), { id: newId(), text: '', imageUrl: null }]);
  }

  protected remove(index: number): void {
    const removed = this.options()[index];
    const options = this.options().filter((_, i) => i !== index);
    let correctIds = this.correctIds().filter((id) => id !== removed.id);
    if (this.mode() === 'single' && correctIds.length === 0 && options[0]) correctIds = [options[0].id];
    this.changed.emit({ options, correctIds });
  }

  private emit(options: ChoiceOption[]): void {
    this.changed.emit({ options, correctIds: this.correctIds() });
  }
}
