import { TestBed } from '@angular/core/testing';
import { TODAY, parsed, resetStorage, testProviders } from '../testing/test-helpers';
import { TaskStore } from './task-store';
import { LEGACY_STORAGE_KEY, LOG_STORAGE_KEY, STORAGE_KEY } from './task-storage';

function createStore() {
  TestBed.configureTestingModule({ providers: testProviders });
  return TestBed.inject(TaskStore);
}

const saved = () => JSON.parse(localStorage.getItem(STORAGE_KEY)!);
const savedLog = () => JSON.parse(localStorage.getItem(LOG_STORAGE_KEY) ?? '{}');

describe('TaskStore', () => {
  beforeEach(() => resetStorage());

  it('crea tareas de bienvenida en la primera visita y las guarda', () => {
    resetStorage({ empty: false });
    const store = createStore();
    expect(store.tasks().length).toBeGreaterThan(0);
    expect(store.tasks().some((t) => t.subtasks.length && t.notes)).toBe(true);
    expect(saved()).toHaveLength(store.tasks().length);
  });

  it('crea las tareas de bienvenida en el idioma del usuario', () => {
    resetStorage({ empty: false, lang: 'en' });
    const store = createStore();
    expect(store.tasks()[0].title).toContain('Type');
    expect(store.tasks()[0].tags).toEqual(['welcome']);
  });

  it('migra las tareas de la versión anterior', () => {
    resetStorage({ empty: false });
    localStorage.setItem(
      LEGACY_STORAGE_KEY,
      JSON.stringify([
        { text: 'Vieja pendiente', completed: false },
        { text: 'Vieja hecha', completed: true },
        { text: '   ', completed: false },
      ]),
    );
    const store = createStore();
    expect(store.tasks().map((t) => [t.title, t.done])).toEqual([
      ['Vieja pendiente', false],
      ['Vieja hecha', true],
    ]);
    expect(store.tasks()[0]).toMatchObject({ notes: '', subtasks: [], repeat: null });
  });

  it('completa campos que faltan en datos guardados por versiones anteriores', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: 'a', title: 'Sin campos nuevos' }]));
    const store = createStore();
    expect(store.tasks()[0]).toMatchObject({
      id: 'a',
      done: false,
      tags: [],
      repeat: null,
      notes: '',
      subtasks: [],
    });
  });

  it('agrega tareas arriba de todo y las persiste', () => {
    const store = createStore();
    store.add(parsed('Primera'));
    store.add(parsed('Segunda'));
    expect(store.pending().map((t) => t.title)).toEqual(['Segunda', 'Primera']);
    expect(saved()).toHaveLength(2);
  });

  describe('completar', () => {
    it('completa, registra la actividad y se puede deshacer', () => {
      const store = createStore();
      const task = store.add(parsed('Algo'));
      const undo = store.toggle(task.id);
      expect(store.completed()[0]).toMatchObject({ id: task.id, done: true });
      expect(store.completedToday()).toBe(1);
      expect(savedLog()).toEqual({ [TODAY]: 1 });

      undo();
      expect(store.pending()[0]).toMatchObject({ done: false, completedAt: null });
      expect(store.completedToday()).toBe(0);
      expect(savedLog()).toEqual({});
    });

    it('una tarea repetitiva deja una copia completada y pasa a la próxima fecha', () => {
      const store = createStore();
      const task = store.add(
        parsed('Sacar la basura', { due: TODAY, repeat: { unit: 'week', every: 1 } }),
      );
      store.addSubtask(task.id, 'Separar reciclables');
      store.updateSubtask(task.id, store.get(task.id)!.subtasks[0].id, { done: true });

      const undo = store.toggle(task.id);
      expect(store.get(task.id)).toMatchObject({ done: false, due: '2026-11-05' });
      expect(store.get(task.id)!.subtasks[0].done).toBe(false);
      expect(store.completed()).toEqual([
        expect.objectContaining({ title: 'Sacar la basura', done: true, repeat: null }),
      ]);
      expect(store.completedToday()).toBe(1);

      undo();
      expect(store.tasks()).toHaveLength(1);
      expect(store.get(task.id)).toMatchObject({ due: TODAY });
      expect(store.completedToday()).toBe(0);
    });
  });

  it('elimina y restaura una tarea en la misma posición', () => {
    const store = createStore();
    store.add(parsed('C'));
    const b = store.add(parsed('B'));
    store.add(parsed('A'));
    const undo = store.remove(b.id);
    expect(store.pending().map((t) => t.title)).toEqual(['A', 'C']);
    undo();
    expect(store.pending().map((t) => t.title)).toEqual(['A', 'B', 'C']);
  });

  it('separa vencidas, hoy y próximas', () => {
    const store = createStore();
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
    const store = createStore();
    store.add(parsed('D'));
    const c = store.add(parsed('C', { tags: ['x'] }));
    store.add(parsed('B'));
    const a = store.add(parsed('A', { tags: ['x'] }));
    store.reorder([c.id, a.id]);
    expect(store.pending().map((t) => t.title)).toEqual(['C', 'B', 'A', 'D']);
    expect(store.pendingWithTag('x').map((t) => t.title)).toEqual(['C', 'A']);
  });

  it('cuenta etiquetas solo de tareas pendientes', () => {
    const store = createStore();
    store.add(parsed('Uno', { tags: ['casa'] }));
    const done = store.add(parsed('Dos', { tags: ['casa', 'auto'] }));
    store.toggle(done.id);
    expect(store.tags()).toEqual([
      { name: 'auto', count: 0 },
      { name: 'casa', count: 1 },
    ]);
  });

  it('borra las completadas sin perder la actividad registrada', () => {
    const store = createStore();
    const done = store.add(parsed('Hecha'));
    store.add(parsed('Pendiente'));
    store.toggle(done.id);
    const { count, undo } = store.clearCompleted();
    expect(count).toBe(1);
    expect(store.tasks().map((t) => t.title)).toEqual(['Pendiente']);
    expect(store.completedToday()).toBe(1);
    undo();
    expect(store.completed()).toHaveLength(1);
  });

  it('administra subtareas', () => {
    const store = createStore();
    const task = store.add(parsed('Mudanza'));
    store.addSubtask(task.id, 'Cajas');
    store.addSubtask(task.id, '  ');
    const [subtask] = store.get(task.id)!.subtasks;
    expect(store.get(task.id)!.subtasks).toHaveLength(1);
    store.updateSubtask(task.id, subtask.id, { done: true, title: 'Cajas grandes' });
    expect(store.get(task.id)!.subtasks[0]).toMatchObject({ done: true, title: 'Cajas grandes' });
    store.removeSubtask(task.id, subtask.id);
    expect(store.get(task.id)!.subtasks).toEqual([]);
  });

  it('agrega varias tareas renovando ids repetidos, y se puede deshacer', () => {
    const store = createStore();
    const existing = store.add(parsed('Existente'));
    const undo = store.addMany([{ ...existing, title: 'Importada' }]);
    expect(store.tasks()).toHaveLength(2);
    expect(new Set(store.tasks().map((t) => t.id)).size).toBe(2);
    expect(store.pending()[0].title).toBe('Importada');
    undo();
    expect(store.tasks().map((t) => t.title)).toEqual(['Existente']);
  });
});
