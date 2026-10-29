import { IconName } from '../ui/icon';
import { Task } from './task';

export type ViewId = 'hoy' | 'proximas' | 'todas' | 'completadas';

export interface ViewMeta {
  id: ViewId;
  icon: IconName;
  /** Atajo de teclado para ir a la vista. */
  shortcut: string;
}

/** Vistas de tareas. El nombre visible sale de las traducciones (`view.<id>`). */
export const VIEWS: ViewMeta[] = [
  { id: 'hoy', icon: 'sun', shortcut: '1' },
  { id: 'proximas', icon: 'calendar', shortcut: '2' },
  { id: 'todas', icon: 'inbox', shortcut: '3' },
  { id: 'completadas', icon: 'circle-check', shortcut: '4' },
];

export const STATS_SHORTCUT = '5';

/** Vista donde aparece una tarea, para poder navegar hasta ella. */
export function viewForTask(task: Task, today: string): ViewId {
  if (task.done) return 'completadas';
  if (task.due && task.due <= today) return 'hoy';
  if (task.due) return 'proximas';
  return 'todas';
}
