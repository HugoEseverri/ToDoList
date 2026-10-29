import { Injectable } from '@angular/core';
import { Task } from './task';

export const STORAGE_KEY = 'hecho.tasks.v1';
/** Clave usada por la primera versión de la app. */
export const LEGACY_STORAGE_KEY = 'tasks';

interface LegacyTask {
  text: string;
  completed: boolean;
  createdAt?: string;
}

/** `null` = no hay nada guardado todavía (primera visita). */
export type StoredTasks = Task[] | null;

@Injectable({ providedIn: 'root' })
export class TaskStorage {
  load(): StoredTasks {
    const current = this.read(STORAGE_KEY);
    if (Array.isArray(current)) return current as Task[];

    const legacy = this.read(LEGACY_STORAGE_KEY);
    if (Array.isArray(legacy)) return migrateLegacy(legacy as LegacyTask[]);

    return null;
  }

  save(tasks: Task[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
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

function migrateLegacy(legacy: LegacyTask[]): Task[] {
  const now = new Date().toISOString();
  return legacy
    .filter((item) => typeof item?.text === 'string' && item.text.trim())
    .map((item, index) => ({
      id: crypto.randomUUID(),
      title: item.text.trim(),
      done: !!item.completed,
      priority: 0,
      due: null,
      time: null,
      tags: [],
      order: index,
      createdAt: item.createdAt ?? now,
      completedAt: item.completed ? now : null,
    }));
}
