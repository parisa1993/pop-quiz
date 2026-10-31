import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../core/toast.service';

const ICONS = { info: '💬', success: '✅', error: '⚠️', party: '🎉' } as const;

@Component({
  selector: 'app-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toasts" aria-live="polite" role="status">
      @for (toast of toasts.toasts(); track toast.id) {
        <button type="button" class="toast toast--{{ toast.kind }} pop-in" (click)="toasts.dismiss(toast.id)">
          <span aria-hidden="true">{{ icons[toast.kind] }}</span>
          <span>{{ toast.text }}</span>
        </button>
      }
    </div>
  `,
  styles: `
    .toasts {
      position: fixed;
      z-index: 1000;
      top: calc(var(--space-3) + var(--safe-top));
      left: 50%;
      transform: translateX(-50%);
      display: grid;
      gap: var(--space-2);
      width: min(92vw, 440px);
      pointer-events: none;
    }
    .toast {
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: var(--space-3);
      width: 100%;
      padding: var(--space-3) var(--space-4);
      border: 0;
      border-radius: var(--radius-m);
      background: var(--c-surface);
      color: var(--c-ink);
      box-shadow: var(--shadow-l);
      font-weight: 700;
      text-align: left;
      cursor: pointer;
      border-left: 6px solid var(--c-primary);
    }
    .toast--success { border-left-color: var(--c-success); }
    .toast--error { border-left-color: var(--c-danger); }
    .toast--party { border-left-color: var(--c-pink); }
  `,
})
export class ToastHostComponent {
  protected readonly toasts = inject(ToastService);
  protected readonly icons = ICONS;
}
