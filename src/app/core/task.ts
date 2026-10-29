/** 0 = sin prioridad, 1 = baja, 2 = media, 3 = alta. */
export type Priority = 0 | 1 | 2 | 3;

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
  /** Posición manual; menor aparece primero. */
  order: number;
  createdAt: string;
  completedAt: string | null;
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  0: 'Sin prioridad',
  1: 'Baja',
  2: 'Media',
  3: 'Alta',
};
