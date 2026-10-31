import { TestBed } from '@angular/core/testing';

const confetti = vi.hoisted(() => vi.fn());
vi.mock('canvas-confetti', () => ({ default: confetti }));

import { NotifyService } from './notify.service';

describe('NotifyService', () => {
  beforeEach(() => {
    confetti.mockClear();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('vibrates and never throws when audio is unavailable', () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    const notify = TestBed.inject(NotifyService);
    expect(() => notify.cue('question')).not.toThrow();
    expect(vibrate).toHaveBeenCalledWith([60]);
  });

  it('throws confetti, more for big celebrations', () => {
    const notify = TestBed.inject(NotifyService);
    notify.celebrate();
    expect(confetti).toHaveBeenCalledTimes(1);
    notify.celebrate(true);
    vi.advanceTimersByTime(500);
    expect(confetti).toHaveBeenCalledTimes(4);
  });

  it('respects reduced motion', () => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn(() => ({ matches: true }) as MediaQueryList);
    TestBed.inject(NotifyService).celebrate(true);
    expect(confetti).not.toHaveBeenCalled();
    window.matchMedia = original;
  });
});
