import { Injectable, signal } from '@angular/core';

export type ToastKind = 'info' | 'success' | 'error' | 'party';

export interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  readonly toasts = signal<Toast[]>([]);

  show(text: string, kind: ToastKind = 'info', durationMs = 3200): void {
    const toast = { id: this.nextId++, kind, text };
    this.toasts.update((list) => [...list.slice(-2), toast]);
    setTimeout(() => this.dismiss(toast.id), durationMs);
  }

  success(text: string): void {
    this.show(text, 'success');
  }

  error(text: string): void {
    this.show(text, 'error', 4500);
  }

  party(text: string): void {
    this.show(text, 'party');
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
