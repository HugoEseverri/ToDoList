import { Injectable, signal } from '@angular/core';

/** Qué tarea está abierta en el panel de detalle (o ninguna). */
@Injectable({ providedIn: 'root' })
export class TaskDetailState {
  readonly openId = signal<string | null>(null);

  open(id: string): void {
    this.openId.set(id);
  }

  close(): void {
    this.openId.set(null);
  }
}
