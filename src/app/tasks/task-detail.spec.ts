import { TestBed } from '@angular/core/testing';
import { TaskDetailState } from '../core/task-detail-state';
import { TaskStore } from '../core/task-store';
import { TODAY, parsed, resetStorage, testProviders } from '../testing/test-helpers';
import { TaskDetail } from './task-detail';

async function setup() {
  TestBed.configureTestingModule({ providers: testProviders });
  const store = TestBed.inject(TaskStore);
  const state = TestBed.inject(TaskDetailState);
  const task = store.add(parsed('Preparar viaje', { due: TODAY }));

  const fixture = TestBed.createComponent(TaskDetail);
  const element = fixture.nativeElement as HTMLElement;
  document.body.appendChild(element);
  state.open(task.id);
  await fixture.whenStable();

  const query = <T extends Element>(selector: string) => element.querySelector<T>(selector)!;
  const setValue = async (selector: string, value: string, event = 'change') => {
    const input = query<HTMLInputElement>(selector);
    input.value = value;
    input.dispatchEvent(new Event(event));
    await fixture.whenStable();
  };
  const enter = async (selector: string, value: string) => {
    const input = query<HTMLInputElement>(selector);
    input.value = value;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();
  };
  return { fixture, element, store, state, task, query, setValue, enter };
}

describe('TaskDetail', () => {
  beforeEach(() => resetStorage());

  it('se abre con la tarea elegida y lleva el foco al título', async () => {
    const { query } = await setup();
    const title = query<HTMLTextAreaElement>('.title-input');
    expect(title.value).toBe('Preparar viaje');
    expect(document.activeElement).toBe(title);
  });

  it('guarda notas, prioridad, hora y repetición', async () => {
    const { store, task, setValue, query, fixture } = await setup();
    await setValue('.notes', 'Llevar pasaporte', 'input');
    query<HTMLButtonElement>('.segment.priority-3').click();
    await fixture.whenStable();
    await setValue('input[type="time"]', '08:30');
    await setValue('select', 'week');

    expect(store.get(task.id)).toMatchObject({
      notes: 'Llevar pasaporte',
      priority: 3,
      time: '08:30',
      repeat: { unit: 'week', every: 1 },
    });
  });

  it('quitar la fecha también quita hora y repetición', async () => {
    const { store, task, setValue } = await setup();
    await setValue('input[type="time"]', '08:30');
    await setValue('select', 'day');
    await setValue('input[type="date"]', '');
    expect(store.get(task.id)).toMatchObject({ due: null, time: null, repeat: null });
  });

  it('agrega etiquetas sin # ni duplicados', async () => {
    const { store, task, enter } = await setup();
    await enter('.tag-input', '#Viajes');
    await enter('.tag-input', 'viajes');
    expect(store.get(task.id)!.tags).toEqual(['viajes']);
  });

  it('administra subtareas', async () => {
    const { store, task, enter, element, fixture } = await setup();
    await enter('.subtask-new .subtask-title', 'Comprar adaptador');
    await enter('.subtask-new .subtask-title', 'Reservar hotel');
    expect(store.get(task.id)!.subtasks.map((s) => s.title)).toEqual([
      'Comprar adaptador',
      'Reservar hotel',
    ]);

    const check = element.querySelector<HTMLInputElement>('.subtask-check')!;
    check.checked = true;
    check.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(store.get(task.id)!.subtasks[0].done).toBe(true);
    expect(element.querySelector('.block .count')!.textContent).toBe('1/2');
  });

  it('el título acepta lenguaje natural', async () => {
    const { store, task, query, fixture } = await setup();
    const title = query<HTMLTextAreaElement>('.title-input');
    title.value = 'Preparar viaje mañana #vacaciones';
    title.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(store.get(task.id)).toMatchObject({
      title: 'Preparar viaje',
      due: '2026-10-30',
      tags: ['vacaciones'],
    });
  });

  it('se cierra con Escape y al eliminar la tarea', async () => {
    const { element, state, task, fixture, store } = await setup();
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(state.openId()).toBeNull();

    state.open(task.id);
    await fixture.whenStable();
    store.remove(task.id);
    await fixture.whenStable();
    expect(state.openId()).toBeNull();
  });
});
