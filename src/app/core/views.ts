import { IconName } from '../ui/icon';
import { Task } from './task';

export type ViewId = 'hoy' | 'proximas' | 'todas' | 'completadas';

export interface ViewMeta {
  id: ViewId;
  label: string;
  icon: IconName;
  /** Atajo de teclado para ir a la vista. */
  shortcut: string;
}

export const VIEWS: ViewMeta[] = [
  { id: 'hoy', label: 'Hoy', icon: 'sun', shortcut: '1' },
  { id: 'proximas', label: 'Próximas', icon: 'calendar', shortcut: '2' },
  { id: 'todas', label: 'Todas', icon: 'inbox', shortcut: '3' },
  { id: 'completadas', label: 'Completadas', icon: 'circle-check', shortcut: '4' },
];

/** Vista donde aparece una tarea, para poder navegar hasta ella. */
export function viewForTask(task: Task, today: string): ViewId {
  if (task.done) return 'completadas';
  if (task.due && task.due <= today) return 'hoy';
  if (task.due) return 'proximas';
  return 'todas';
}
