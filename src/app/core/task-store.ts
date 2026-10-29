import { Injectable, computed, inject, signal } from '@angular/core';
import { Clock } from './clock';
import { addDays } from './dates';
import { ParsedTask } from './quick-add-parser';
import { Task } from './task';
import { TaskStorage } from './task-storage';

export interface TagSummary {
  name: string;
  count: number;
}

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

  private readonly _tasks = signal<Task[]>(
    this.storage.load() ?? createWelcomeTasks(this.clock.today()),
  );
  readonly tasks = this._tasks.asReadonly();

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
  readonly completedToday = computed(
    () => this.completed().filter((t) => t.completedAt?.startsWith(this.clock.today())).length,
  );
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

  pendingWithTag(tag: string): Task[] {
    return this.pending().filter((t) => t.tags.includes(tag));
  }

  add(parsed: ParsedTask): Task {
    const tasks = this._tasks();
    const task: Task = {
      id: crypto.randomUUID(),
      title: parsed.title,
      done: false,
      priority: parsed.priority,
      due: parsed.due,
      time: parsed.time,
      tags: parsed.tags,
      order: tasks.length ? Math.min(...tasks.map((t) => t.order)) - 1 : 0,
      createdAt: this.clock.now().toISOString(),
      completedAt: null,
    };
    this.commit([task, ...tasks]);
    return task;
  }

  update(id: string, patch: Partial<Omit<Task, 'id'>>): void {
    this.commit(this._tasks().map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  toggle(id: string): void {
    const task = this._tasks().find((t) => t.id === id);
    if (!task) return;
    this.update(id, {
      done: !task.done,
      completedAt: task.done ? null : this.clock.now().toISOString(),
    });
  }

  remove(id: string): Task | undefined {
    const task = this._tasks().find((t) => t.id === id);
    if (task) this.commit(this._tasks().filter((t) => t.id !== id));
    return task;
  }

  /** Vuelve a insertar tareas eliminadas (para "Deshacer"), conservando su posición. */
  restore(...tasks: Task[]): void {
    const ids = new Set(this._tasks().map((t) => t.id));
    this.commit([...this._tasks(), ...tasks.filter((t) => !ids.has(t.id))]);
  }

  clearCompleted(): Task[] {
    const removed = this.completed();
    this.commit(this._tasks().filter((t) => !t.done));
    return removed;
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

  private commit(tasks: Task[]): void {
    this._tasks.set(tasks);
    this.storage.save(tasks);
  }
}

/** Tareas de ejemplo para la primera visita: enseñan a usar la app usándola. */
function createWelcomeTasks(today: string): Task[] {
  const now = new Date().toISOString();
  const base = {
    done: false,
    priority: 0,
    due: null,
    time: null,
    tags: [],
    createdAt: now,
    completedAt: null,
  } as const;
  const seeds: Partial<Task>[] = [
    {
      title: 'Escribí "Llamar a Ana mañana 10hs #trabajo !alta" en la barra de arriba',
      due: today,
      priority: 3,
      tags: ['bienvenida'],
    },
    { title: 'Abrí la paleta de comandos con Ctrl + K', due: today, tags: ['bienvenida'] },
    { title: 'Arrastrá las tareas para reordenarlas', due: today, tags: ['bienvenida'] },
    {
      title: 'Navegá con ↑ ↓, completá con Espacio y editá con Enter',
      due: today,
      tags: ['bienvenida'],
    },
    {
      title: 'Revisar las tareas de la semana',
      due: addDays(today, 2),
      time: '09:00',
      priority: 2,
      tags: ['personal'],
    },
    { title: 'Probá el modo claro y oscuro desde la barra lateral', tags: ['bienvenida'] },
  ];
  return seeds.map((seed, order) => ({ ...base, ...seed, id: crypto.randomUUID(), order }) as Task);
}
