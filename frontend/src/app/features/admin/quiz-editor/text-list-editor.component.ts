import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { newId } from '@pop-quiz/shared';

export interface TextItem {
  id: string;
  text: string;
}

/** An editable list of short texts: accepted answers, or ordering items (draggable). */
@Component({
  selector: 'app-text-list-editor',
  imports: [CdkDropList, CdkDrag, CdkDragHandle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="list" cdkDropList [cdkDropListDisabled]="!draggable()" (cdkDropListDropped)="drop($event)">
      @for (item of items(); track item.id; let i = $index) {
        <li class="list__item" cdkDrag cdkDragLockAxis="y">
          @if (draggable()) {
            <button type="button" class="drag-handle" cdkDragHandle aria-label="Drag to reorder">⠿</button>
            <span class="list__num">{{ i + 1 }}</span>
          }
          <input
            class="input"
            [value]="item.text"
            (input)="edit(i, $any($event.target).value)"
            [placeholder]="placeholder() + ' ' + (i + 1)"
            [attr.aria-label]="placeholder() + ' ' + (i + 1)"
            maxlength="120"
          />
          <button type="button" class="icon-btn" (click)="remove(i)" [disabled]="items().length <= min()" [attr.aria-label]="'Remove ' + (i + 1)">
            ✕
          </button>
        </li>
      }
    </ol>
    @if (items().length < max()) {
      <button type="button" class="btn btn--soft" (click)="add()">＋ {{ addLabel() }}</button>
    }
  `,
  styles: `
    .list { list-style: none; margin: 0 0 var(--space-3); padding: 0; display: grid; gap: var(--space-2); }
    .list__item { display: flex; align-items: center; gap: var(--space-2); background: var(--c-surface); border-radius: var(--radius-m); }
    .list__num { font-weight: 800; color: var(--c-primary); width: 1.5em; text-align: center; }
  `,
})
export class TextListEditorComponent {
  readonly items = input.required<TextItem[]>();
  readonly placeholder = input('Item');
  readonly addLabel = input('Add');
  readonly min = input(1);
  readonly max = input(6);
  readonly draggable = input(false);
  readonly changed = output<TextItem[]>();

  protected edit(index: number, text: string): void {
    this.changed.emit(this.items().map((item, i) => (i === index ? { ...item, text } : item)));
  }

  protected add(): void {
    this.changed.emit([...this.items(), { id: newId(), text: '' }]);
  }

  protected remove(index: number): void {
    this.changed.emit(this.items().filter((_, i) => i !== index));
  }

  protected drop(event: CdkDragDrop<TextItem[]>): void {
    const copy = [...this.items()];
    moveItemInArray(copy, event.previousIndex, event.currentIndex);
    this.changed.emit(copy);
  }
}
