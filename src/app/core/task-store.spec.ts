import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Clock } from './clock';
import { ParsedTask } from './quick-add-parser';
import { TaskStore } from './task-store';
import { LEGACY_STORAGE_KEY, STORAGE_KEY } from './task-storage';

const TODAY = '2026-10-29';

class FakeClock {
  readonly today = signal(TODAY);
  now() {
    return new Date('2026-10-29T12:00:00');
  }
}

const parsed = (title: string, extra: Partial<ParsedTask> = {}): ParsedTask => ({
  title,
  due: null,
  time: null,
  tags: [],
  priority: 0,
  ...extra,
});

function createStore() {
  TestBed.configureTestingModule({ providers: [{ provide: Clock, useClass: FakeClock }] });
  return TestBed.inject(TaskStore);
}

/** Store vacío (sin las tareas de bienvenida). */
function createEmptyStore() {
  localStorage.setItem(STORAGE_KEY, '[]');
  return createStore();
}

const saved = () => JSON.parse(localStorage.getItem(STORAGE_KEY)!);

describe('TaskStore', () => {
  beforeEach(() => localStorage.clear());

  it('crea tareas de bienvenida en la primera visita y las guarda', () => {
    const store = createStore();
    expect(store.tasks().length).toBeGreaterThan(0);
    expect(saved()).toHaveLength(store.tasks().length);
  });

  it('migra las tareas de la versión anterior', () => {
    localStorage.setItem(
      LEGACY_STORAGE_KEY,
      JSON.stringify([
        { text: 'Vieja pendiente', completed: false },
        { text: 'Vieja hecha', completed: true },
      ]),
    );
    const store = createStore();
    expect(store.tasks().map((t) => [t.title, t.done])).toEqual([
      ['Vieja pendiente', false],
      ['Vieja hecha', true],
    ]);
    expect(saved()).toHaveLength(2);
  });

  it('agrega tareas arriba de todo y las persiste', () => {
    const store = createEmptyStore();
    store.add(parsed('Primera'));
    store.add(parsed('Segunda'));
    expect(store.pending().map((t) => t.title)).toEqual(['Segunda', 'Primera']);
    expect(saved()).toHaveLength(2);
  });

  it('completa y descompleta tareas', () => {
    const store = createEmptyStore();
    const task = store.add(parsed('Algo'));
    store.toggle(task.id);
    expect(store.completed()[0]).toMatchObject({ id: task.id, done: true });
    expect(store.completedToday()).toBe(1);
    store.toggle(task.id);
    expect(store.pending()[0]).toMatchObject({ done: false, completedAt: null });
  });

  it('elimina y restaura una tarea en la misma posición', () => {
    const store = createEmptyStore();
    store.add(parsed('C'));
    const b = store.add(parsed('B'));
    store.add(parsed('A'));
    const removed = store.remove(b.id)!;
    expect(store.pending().map((t) => t.title)).toEqual(['A', 'C']);
    store.restore(removed);
    expect(store.pending().map((t) => t.title)).toEqual(['A', 'B', 'C']);
  });

  it('separa vencidas, hoy y próximas', () => {
    const store = createEmptyStore();
    store.add(parsed('Vencida', { due: '2026-10-20' }));
    store.add(parsed('Hoy', { due: TODAY }));
    store.add(parsed('Más tarde', { due: '2026-11-10' }));
    store.add(parsed('Pronto', { due: '2026-10-30', time: '10:00' }));
    store.add(parsed('Sin fecha'));
    expect(store.overdue().map((t) => t.title)).toEqual(['Vencida']);
    expect(store.dueToday().map((t) => t.title)).toEqual(['Hoy']);
    expect(store.upcoming().map((t) => t.title)).toEqual(['Pronto', 'Más tarde']);
  });

  it('reordena solo las tareas indicadas', () => {
    const store = createEmptyStore();
    store.add(parsed('D'));
    const c = store.add(parsed('C', { tags: ['x'] }));
    store.add(parsed('B'));
    const a = store.add(parsed('A', { tags: ['x'] }));
    store.reorder([c.id, a.id]);
    expect(store.pending().map((t) => t.title)).toEqual(['C', 'B', 'A', 'D']);
    expect(store.pendingWithTag('x').map((t) => t.title)).toEqual(['C', 'A']);
  });

  it('cuenta etiquetas solo de tareas pendientes', () => {
    const store = createEmptyStore();
    store.add(parsed('Uno', { tags: ['casa'] }));
    const done = store.add(parsed('Dos', { tags: ['casa', 'auto'] }));
    store.toggle(done.id);
    expect(store.tags()).toEqual([
      { name: 'auto', count: 0 },
      { name: 'casa', count: 1 },
    ]);
  });

  it('borra las completadas y permite recuperarlas', () => {
    const store = createEmptyStore();
    const done = store.add(parsed('Hecha'));
    store.add(parsed('Pendiente'));
    store.toggle(done.id);
    const removed = store.clearCompleted();
    expect(store.tasks().map((t) => t.title)).toEqual(['Pendiente']);
    store.restore(...removed);
    expect(store.completed()).toHaveLength(1);
  });
});
