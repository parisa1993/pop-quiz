import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows toasts of each kind and auto-dismisses them', () => {
    const toasts = TestBed.inject(ToastService);
    toasts.success('Saved');
    toasts.error('Oops');
    toasts.party('Yay');
    expect(toasts.toasts().map((t) => [t.kind, t.text])).toEqual([
      ['success', 'Saved'],
      ['error', 'Oops'],
      ['party', 'Yay'],
    ]);
    vi.advanceTimersByTime(5000);
    expect(toasts.toasts()).toEqual([]);
  });

  it('keeps at most three and can be dismissed', () => {
    const toasts = TestBed.inject(ToastService);
    ['a', 'b', 'c', 'd'].forEach((t) => toasts.show(t));
    expect(toasts.toasts().map((t) => t.text)).toEqual(['b', 'c', 'd']);
    toasts.dismiss(toasts.toasts()[0].id);
    expect(toasts.toasts()).toHaveLength(2);
  });
});
