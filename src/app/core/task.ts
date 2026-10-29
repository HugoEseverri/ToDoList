import { Repeat } from './recurrence';

/** 0 = sin prioridad, 1 = baja, 2 = media, 3 = alta. */
export type Priority = 0 | 1 | 2 | 3;

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  done: boolean;
  priority: Priority;
  /** Fecha local en formato `YYYY-MM-DD`. */
  due: string | null;
  /** Hora local en formato `HH:mm`. */
  time: string | null;
  tags: string[];
  repeat: Repeat | null;
  notes: string;
  subtasks: Subtask[];
  /** Posición manual; menor aparece primero. */
  order: number;
  createdAt: string;
  completedAt: string | null;
}

const isIsoDate = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

/**
 * Valida y completa una tarea leída de afuera (localStorage de una versión anterior o un JSON
 * importado). Devuelve `null` si no se puede recuperar.
 */
export function normalizeTask(raw: unknown, index = 0): Task | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;
  const title = typeof t['title'] === 'string' ? t['title'].trim() : '';
  if (!title) return null;
  const priority = [0, 1, 2, 3].includes(t['priority'] as number) ? (t['priority'] as Priority) : 0;
  const repeat = t['repeat'] as Repeat | null | undefined;
  const validRepeat =
    repeat && ['day', 'weekday', 'week', 'month', 'year'].includes(repeat.unit) && repeat.every > 0
      ? repeat
      : null;
  return {
    id: typeof t['id'] === 'string' && t['id'] ? t['id'] : crypto.randomUUID(),
    title,
    done: !!t['done'],
    priority,
    due: isIsoDate(t['due']) ? t['due'] : null,
    time: typeof t['time'] === 'string' && /^\d{2}:\d{2}$/.test(t['time']) ? t['time'] : null,
    tags: Array.isArray(t['tags'])
      ? t['tags'].filter((tag): tag is string => typeof tag === 'string')
      : [],
    repeat: validRepeat,
    notes: typeof t['notes'] === 'string' ? t['notes'] : '',
    subtasks: Array.isArray(t['subtasks'])
      ? (t['subtasks'] as Partial<Subtask>[])
          .filter((s) => typeof s?.title === 'string' && s.title.trim())
          .map((s) => ({ id: s.id ?? crypto.randomUUID(), title: s.title!, done: !!s.done }))
      : [],
    order: typeof t['order'] === 'number' ? t['order'] : index,
    createdAt: typeof t['createdAt'] === 'string' ? t['createdAt'] : new Date().toISOString(),
    completedAt: typeof t['completedAt'] === 'string' ? t['completedAt'] : null,
  };
}
