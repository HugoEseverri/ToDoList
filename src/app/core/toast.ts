import { Injectable, signal } from '@angular/core';

export interface ToastMessage {
  id: number;
  message: string;
  actionLabel?: string;
  action?: () => void;
}

const DURATION_MS = 5000;

@Injectable({ providedIn: 'root' })
export class Toast {
  private nextId = 0;
  private timer?: ReturnType<typeof setTimeout>;
  readonly current = signal<ToastMessage | null>(null);

  show(message: string, options: { actionLabel?: string; action?: () => void } = {}): void {
    clearTimeout(this.timer);
    this.current.set({ id: ++this.nextId, message, ...options });
    this.timer = setTimeout(() => this.dismiss(), DURATION_MS);
  }

  /** Muestra un aviso con botón "Deshacer". */
  undoable(message: string, undo: () => void): void {
    this.show(message, { actionLabel: 'Deshacer', action: undo });
  }

  runAction(): void {
    const toast = this.current();
    this.dismiss();
    toast?.action?.();
  }

  dismiss(): void {
    clearTimeout(this.timer);
    this.current.set(null);
  }
}
