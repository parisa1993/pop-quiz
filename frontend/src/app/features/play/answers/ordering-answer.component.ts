import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDropList,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, input, linkedSignal, output } from '@angular/core';
import type { AnswerPayload, OrderItem, PublicQuestion } from '@pop-quiz/shared';

/** Drag (or use the arrows) to put items in order, then lock it in. */
@Component({
  selector: 'app-ordering-answer',
  imports: [CdkDropList, CdkDrag, CdkDragHandle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="hint">{{ locked() ? 'Your order' : 'Drag into the right order (top = first)' }}</p>
    <ol
      class="order"
      cdkDropList
      [cdkDropListDisabled]="locked()"
      (cdkDropListDropped)="drop($event)"
    >
      @for (item of items(); track item.id; let i = $index, last = $last) {
        <li class="order__item" cdkDrag cdkDragLockAxis="y">
          <span class="order__num">{{ i + 1 }}</span>
          <button
            type="button"
            class="drag-handle"
            cdkDragHandle
            aria-label="Drag to reorder"
            [disabled]="locked()"
          >
            ⠿
          </button>
          <span class="order__text">{{ item.text }}</span>
          @if (!locked()) {
            <span class="order__arrows">
              <button
                type="button"
                class="icon-btn"
                [disabled]="i === 0"
                (click)="move(i, -1)"
                [attr.aria-label]="'Move ' + item.text + ' up'"
              >
                ↑
              </button>
              <button
                type="button"
                class="icon-btn"
                [disabled]="last"
                (click)="move(i, 1)"
                [attr.aria-label]="'Move ' + item.text + ' down'"
              >
                ↓
              </button>
            </span>
          }
        </li>
      }
    </ol>
    @if (!locked()) {
      <button type="button" class="btn btn--yellow btn--lg btn--block" (click)="submit()">
        Lock in my order 🔒
      </button>
    }
  `,
  styles: `
    .hint {
      color: var(--c-ink-soft);
      font-weight: 700;
      font-size: var(--fs-s);
    }
    .order {
      list-style: none;
      padding: 0;
      margin: 0 0 var(--space-4);
      display: grid;
      gap: var(--space-2);
    }
    .order__item {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-height: 60px;
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-m);
      background: var(--c-surface-2);
      color: var(--c-ink);
      font-weight: 700;
    }
    .order__num {
      flex: none;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: var(--c-primary);
      color: #fff;
      font-family: var(--font-display);
    }
    .order__text {
      flex: 1;
      min-width: 0;
    }
    .order__arrows {
      display: flex;
      gap: var(--space-1);
    }
  `,
})
export class OrderingAnswerComponent {
  readonly question = input.required<PublicQuestion>();
  readonly answer = input<AnswerPayload | null>(null);
  readonly locked = input(false);
  readonly submitted = output<AnswerPayload>();

  protected readonly items = linkedSignal<OrderItem[]>(() => {
    const items = this.question().config.items ?? [];
    const saved = (this.answer() as { itemIds?: string[] } | null)?.itemIds;
    if (!saved) return [...items];
    return saved.map((id) => items.find((i) => i.id === id)).filter((i): i is OrderItem => !!i);
  });

  protected drop(event: CdkDragDrop<OrderItem[]>): void {
    this.items.update((list) => {
      const copy = [...list];
      moveItemInArray(copy, event.previousIndex, event.currentIndex);
      return copy;
    });
  }

  protected move(index: number, step: number): void {
    this.items.update((list) => {
      const copy = [...list];
      moveItemInArray(copy, index, index + step);
      return copy;
    });
  }

  protected submit(): void {
    this.submitted.emit({ itemIds: this.items().map((i) => i.id) });
  }
}
