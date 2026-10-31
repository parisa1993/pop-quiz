import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';

/** A button that asks "Sure?" inline before doing something destructive. */
@Component({
  selector: 'app-confirm-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (asking()) {
      <span class="confirm pop-in" role="group" [attr.aria-label]="question()">
        <span class="confirm__q">{{ question() }}</span>
        <button type="button" class="btn btn--danger" (click)="confirm()">{{ yesLabel() }}</button>
        <button type="button" class="btn btn--soft" (click)="asking.set(false)">Cancel</button>
      </span>
    } @else {
      <button type="button" [class]="buttonClass()" [disabled]="disabled()" (click)="asking.set(true)">
        <ng-content />
      </button>
    }
  `,
  styles: `
    .confirm {
      display: inline-flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
    .confirm__q {
      font-weight: 700;
    }
  `,
})
export class ConfirmButtonComponent {
  readonly question = input('Are you sure?');
  readonly yesLabel = input('Yes, do it');
  readonly buttonClass = input('btn btn--soft');
  readonly disabled = input(false);
  readonly confirmed = output<void>();
  protected readonly asking = signal(false);

  protected confirm(): void {
    this.asking.set(false);
    this.confirmed.emit();
  }
}
