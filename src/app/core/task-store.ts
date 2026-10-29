import { Injectable, computed, inject, signal } from '@angular/core';
import { I18n } from '../i18n/i18n';
import { Clock } from './clock';
import { localDay } from './dates';
import { ParsedTask } from './quick-add-parser';
import { nextOccurrence } from './recurrence';
import { Subtask, Task } from './task';
import { CompletionLog, TaskStorage } from './task-storage';
import { createWelcomeTasks } from './welcome-tasks';

export interface TagSummary {
  name: string;
  count: number;
}

/** Revierte una operación (para los botones "Deshacer"). */
export type Undo = () => void;
const NOTHING_TO_UNDO: Undo = () => undefined;

const byOrder = (a: Task, b: Task) => a.order - b.order;
const byDueThenOrder = (a: Task, b: Task) =>
  (a.due ?? '').localeCompare(b.due ?? '') ||
  (a.time ?? '99:99').localeCompare(b.time ?? '99:99') ||
  byOrder(a, b);

/** Estado de las tareas: una única fuente de verdad basada en signals, persistida en localStorage. */
@Injectable({ providedIn: 'root' })
export class TaskStore {
  private readonly storage = inject(TaskStorage);
  private readonly clock = inject(Clock);
  private readonly i18n = inject(I18n);

  private readonly _tasks = signal<Task[]>(
    this.storage.load() ?? createWelcomeTasks(this.clock.today(), this.i18n.t),
  );
  private readonly _log = signal<CompletionLog>(this.storage.loadLog());
  readonly tasks = this._tasks.asReadonly();
  /** Tareas completadas por día; alimenta las estadísticas. */
  readonly log = this._log.asReadonly();

  readonly pending = computed(() =>
    this._tasks()
      .filter((t) => !t.done)
      .sort(byOrder),
  );
  readonly overdue = computed(() =>
    this.pending().filter((t) => !!t.due && t.due < this.clock.today()),
  );
  readonly dueToday = computed(() => this.pending().filter((t) => t.due === this.clock.today()));
  readonly upcoming = computed(() =>
    this.pending()
      .filter((t) => !!t.due && t.due > this.clock.today())
      .sort(byDueThenOrder),
  );
  readonly completed = computed(() =>
    this._tasks()
      .filter((t) => t.done)
      .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')),
  );
  readonly completedToday = computed(() => this._log()[this.clock.today()] ?? 0);
  readonly tags = computed<TagSummary[]>(() => {
    const counts = new Map<string, number>();
    for (const task of this._tasks()) {
      for (const tag of task.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + (task.done ? 0 : 1));
      }
    }
    return [...counts]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  });

  constructor() {
    // Persiste la migración o los datos de bienvenida desde la primera carga.
    this.storage.save(this._tasks());
  }

  get(id: string): Task | undefined {
    return this._tasks().find((t) => t.id === id);
  }

  pendingWithTag(tag: string): Task[] {
    return this.pending().filter((t) => t.tags.includes(tag));
  }

  add(parsed: Omit<ParsedTask, 'tokens'>): Task {
    const task: Task = {
      id: crypto.randomUUID(),
      title: parsed.title,
      done: false,
      priority: parsed.priority,
      due: parsed.due,
      time: parsed.time,
      tags: parsed.tags,
      repeat: parsed.repeat,
      notes: '',
      subtasks: [],
      order: this.topOrder(),
      createdAt: this.clock.now().toISOString(),
      completedAt: null,
    };
    this.commit([task, ...this._tasks()]);
    return task;
  }

  update(id: string, patch: Partial<Omit<Task, 'id'>>): void {
    this.commit(this._tasks().map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  /**
   * Completa o reabre una tarea. Si se repite, queda una copia en "Completadas" y la tarea
   * original pasa a su próxima fecha. Devuelve cómo deshacerlo.
   */
  toggle(id: string): Undo {
    const task = this.get(id);
    if (!task) return NOTHING_TO_UNDO;
    const now = this.clock.now().toISOString();

    if (task.done) {
      this.update(id, { done: false, completedAt: null });
      this.logCompletion(task.completedAt, -1);
      return () => {
        this.update(id, { done: true, completedAt: task.completedAt });
        this.logCompletion(task.completedAt, 1);
      };
    }

    if (task.repeat && task.due) {
      const record: Task = {
        ...task,
        id: crypto.randomUUID(),
        done: true,
        completedAt: now,
        repeat: null,
        subtasks: task.subtasks.map((s) => ({ ...s })),
      };
      const next = nextOccurrence(task.due, task.repeat, this.clock.today());
      this.commit([
        ...this._tasks().map((t) =>
          t.id === id
            ? { ...t, due: next, subtasks: t.subtasks.map((s) => ({ ...s, done: false })) }
            : t,
        ),
        record,
      ]);
      this.logCompletion(now, 1);
      return () => {
        this.commit([...this._tasks().filter((t) => t.id !== record.id && t.id !== id), task]);
        this.logCompletion(now, -1);
      };
    }

    this.update(id, { done: true, completedAt: now });
    this.logCompletion(now, 1);
    return () => {
      this.update(id, { done: false, completedAt: null });
      this.logCompletion(now, -1);
    };
  }

  remove(id: string): Undo {
    const task = this.get(id);
    if (!task) return NOTHING_TO_UNDO;
    this.commit(this._tasks().filter((t) => t.id !== id));
    return () => this.restore(task);
  }

  clearCompleted(): { count: number; undo: Undo } {
    const removed = this.completed();
    this.commit(this._tasks().filter((t) => !t.done));
    return { count: removed.length, undo: () => this.restore(...removed) };
  }

  /** Agrega tareas importadas o de ejemplo arriba de todo. Los ids repetidos se renuevan. */
  addMany(tasks: Task[]): Undo {
    const existing = new Set(this._tasks().map((t) => t.id));
    const top = this.topOrder() - tasks.length;
    const added = tasks.map((t, i) => ({
      ...t,
      id: existing.has(t.id) ? crypto.randomUUID() : t.id,
      order: top + i,
    }));
    this.commit([...added, ...this._tasks()]);
    const ids = new Set(added.map((t) => t.id));
    return () => this.commit(this._tasks().filter((t) => !ids.has(t.id)));
  }

  addWelcomeTasks(): Undo {
    return this.addMany(createWelcomeTasks(this.clock.today(), this.i18n.t));
  }

  addSubtask(taskId: string, title: string): void {
    const task = this.get(taskId);
    if (!task || !title.trim()) return;
    const subtask: Subtask = { id: crypto.randomUUID(), title: title.trim(), done: false };
    this.update(taskId, { subtasks: [...task.subtasks, subtask] });
  }

  updateSubtask(taskId: string, subtaskId: string, patch: Partial<Omit<Subtask, 'id'>>): void {
    const task = this.get(taskId);
    if (!task) return;
    this.update(taskId, {
      subtasks: task.subtasks.map((s) => (s.id === subtaskId ? { ...s, ...patch } : s)),
    });
  }

  removeSubtask(taskId: string, subtaskId: string): void {
    const task = this.get(taskId);
    if (!task) return;
    this.update(taskId, { subtasks: task.subtasks.filter((s) => s.id !== subtaskId) });
  }

  /** Vuelve a insertar tareas eliminadas (para "Deshacer"), conservando su posición. */
  restore(...tasks: Task[]): void {
    const ids = new Set(this._tasks().map((t) => t.id));
    this.commit([...this._tasks(), ...tasks.filter((t) => !ids.has(t.id))]);
  }

  /**
   * Recibe el nuevo orden visual de un subconjunto de tareas y les reasigna sus mismos valores
   * de `order`, así el resto de las listas no se ve afectado.
   */
  reorder(orderedIds: string[]): void {
    const tasks = this._tasks();
    const slots = orderedIds
      .map((id) => tasks.find((t) => t.id === id)?.order)
      .filter((order): order is number => order !== undefined)
      .sort((a, b) => a - b);
    const nextOrder = new Map(orderedIds.map((id, i) => [id, slots[i]]));
    this.commit(
      tasks.map((t) => (nextOrder.has(t.id) ? { ...t, order: nextOrder.get(t.id)! } : t)),
    );
  }

  private topOrder(): number {
    const tasks = this._tasks();
    return tasks.length ? Math.min(...tasks.map((t) => t.order)) - 1 : 0;
  }

  /** Registra (o descuenta, al deshacer) una tarea completada en el día correspondiente. */
  private logCompletion(isoDateTime: string | null, delta: 1 | -1): void {
    if (!isoDateTime) return;
    const day = localDay(isoDateTime);
    const log = { ...this._log() };
    const count = Math.max(0, (log[day] ?? 0) + delta);
    if (count) log[day] = count;
    else delete log[day];
    this._log.set(log);
    this.storage.saveLog(log);
  }

  private commit(tasks: Task[]): void {
    this._tasks.set(tasks);
    this.storage.save(tasks);
  }
}
