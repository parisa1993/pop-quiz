import { inject, Injectable, InjectionToken } from '@angular/core';
import confetti from 'canvas-confetti';

export const CONFETTI = new InjectionToken<typeof confetti>('CONFETTI', {
  providedIn: 'root',
  factory: () => confetti,
});

type Cue = 'start' | 'question' | 'correct' | 'wrong' | 'finish';

const TONES: Record<Cue, number[]> = {
  start: [523, 659, 784],
  question: [660, 880],
  correct: [784, 1047],
  wrong: [330, 247],
  finish: [523, 659, 784, 1047],
};

const VIBRATION: Record<Cue, number[]> = {
  start: [80, 60, 80],
  question: [60],
  correct: [40, 40, 40],
  wrong: [200],
  finish: [100, 60, 100, 60, 200],
};

/** In-app "push" feedback: a tiny chime, a buzz on phones and confetti. */
@Injectable({ providedIn: 'root' })
export class NotifyService {
  private readonly confetti = inject(CONFETTI);
  private audio: AudioContext | null = null;

  cue(cue: Cue): void {
    this.vibrate(VIBRATION[cue]);
    this.beep(TONES[cue]);
  }

  celebrate(big = false): void {
    if (this.reducedMotion()) return;
    const colors = ['#ff4f8b', '#ffc93c', '#13b394', '#3d7bff', '#ffffff'];
    void this.confetti({
      particleCount: big ? 160 : 70,
      spread: big ? 100 : 70,
      origin: { y: 0.65 },
      colors,
    });
    if (big) {
      setTimeout(
        () =>
          void this.confetti({
            particleCount: 90,
            angle: 60,
            spread: 70,
            origin: { x: 0 },
            colors,
          }),
        250,
      );
      setTimeout(
        () =>
          void this.confetti({
            particleCount: 90,
            angle: 120,
            spread: 70,
            origin: { x: 1 },
            colors,
          }),
        400,
      );
    }
  }

  private vibrate(pattern: number[]): void {
    try {
      navigator.vibrate?.(pattern);
    } catch {
      // Not supported (e.g. iOS): ignore.
    }
  }

  private beep(frequencies: number[]): void {
    try {
      const AudioCtx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.audio ??= new AudioCtx();
      const ctx = this.audio;
      frequencies.forEach((frequency, i) => {
        const start = ctx.currentTime + i * 0.12;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.12, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.22);
      });
    } catch {
      // Audio blocked until the user interacts: ignore.
    }
  }

  private reducedMotion(): boolean {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }
}
