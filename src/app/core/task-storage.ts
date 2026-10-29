import { Injectable } from '@angular/core';
import { Task, normalizeTask } from './task';

export const STORAGE_KEY = 'hecho.tasks.v1';
/** Clave usada por la primera versión de la app. */
export const LEGACY_STORAGE_KEY = 'tasks';
export const LOG_STORAGE_KEY = 'hecho.log.v1';

interface LegacyTask {
  text: string;
  completed: boolean;
  createdAt?: string;
}

/** Cantidad de tareas completadas por día (`YYYY-MM-DD`). Sobrevive a "Borrar completadas". */
export type CompletionLog = Record<string, number>;

/** `null` = no hay nada guardado todavía (primera visita). */
export type StoredTasks = Task[] | null;

@Injectable({ providedIn: 'root' })
export class TaskStorage {
  load(): StoredTasks {
    const current = this.read(STORAGE_KEY);
    if (Array.isArray(current)) return normalizeAll(current);

    const legacy = this.read(LEGACY_STORAGE_KEY);
    if (Array.isArray(legacy)) {
      return normalizeAll(
        (legacy as LegacyTask[]).map((item) => ({
          title: item?.text,
          done: item?.completed,
          createdAt: item?.createdAt,
          completedAt: item?.completed ? new Date().toISOString() : null,
        })),
      );
    }

    return null;
  }

  save(tasks: Task[]): void {
    this.write(STORAGE_KEY, tasks);
  }

  loadLog(): CompletionLog {
    const log = this.read(LOG_STORAGE_KEY);
    return log && typeof log === 'object' && !Array.isArray(log) ? (log as CompletionLog) : {};
  }

  saveLog(log: CompletionLog): void {
    this.write(LOG_STORAGE_KEY, log);
  }

  private write(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Modo privado o cuota llena: la app sigue funcionando en memoria.
    }
  }

  private read(key: string): unknown {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}

export function normalizeAll(items: unknown[]): Task[] {
  return items
    .map((item, index) => normalizeTask(item, index))
    .filter((task): task is Task => !!task);
}
