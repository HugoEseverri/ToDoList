import { Provider, signal } from '@angular/core';
import { Clock } from '../core/clock';
import { ParsedTask } from '../core/quick-add-parser';
import { STORAGE_KEY } from '../core/task-storage';

/** Jueves 29 de octubre de 2026, al mediodía. */
export const TODAY = '2026-10-29';

export class FakeClock {
  readonly today = signal(TODAY);
  now(): Date {
    return new Date('2026-10-29T12:00:00');
  }
}

export const testProviders: Provider[] = [{ provide: Clock, useClass: FakeClock }];

/**
 * Deja el storage en un estado conocido antes de crear servicios: idioma español y,
 * si `empty`, sin las tareas de bienvenida.
 */
export function resetStorage({ empty = true, lang = 'es' } = {}): void {
  localStorage.clear();
  localStorage.setItem('hecho.lang', lang);
  if (empty) localStorage.setItem(STORAGE_KEY, '[]');
}

export const parsed = (
  title: string,
  extra: Partial<Omit<ParsedTask, 'tokens'>> = {},
): Omit<ParsedTask, 'tokens'> => ({
  title,
  due: null,
  time: null,
  tags: [],
  priority: 0,
  repeat: null,
  ...extra,
});
