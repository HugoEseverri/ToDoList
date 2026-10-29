import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { toIsoDate } from './dates';

/** Fecha de hoy como signal; se actualiza sola al pasar la medianoche. */
@Injectable({ providedIn: 'root' })
export class Clock {
  private readonly _today = signal(toIsoDate(new Date()));
  readonly today = this._today.asReadonly();

  constructor() {
    const id = setInterval(() => this._today.set(toIsoDate(new Date())), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }

  now(): Date {
    return new Date();
  }
}
