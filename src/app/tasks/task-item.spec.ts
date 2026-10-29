import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Clock } from '../core/clock';
import { TaskStore } from '../core/task-store';
import { STORAGE_KEY } from '../core/task-storage';
import { Toast } from '../core/toast';
import { TaskItem } from './task-item';

class FakeClock {
  readonly today = signal('2026-10-29');
  now() {
    return new Date('2026-10-29T12:00:00');
  }
}

async function setup() {
  localStorage.setItem(STORAGE_KEY, '[]');
  TestBed.configureTestingModule({ providers: [{ provide: Clock, useClass: FakeClock }] });
  const store = TestBed.inject(TaskStore);
  const task = store.add({
    title: 'Comprar pan',
    due: '2026-10-28',
    time: null,
    tags: ['casa'],
    priority: 0,
  });

  const fixture = TestBed.createComponent(TaskItem);
  fixture.componentRef.setInput('task', task);
  await fixture.whenStable();

  const element = fixture.nativeElement as HTMLElement;
  const row = element.querySelector<HTMLElement>('[data-task-row]')!;
  const press = async (key: string) => {
    row.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    fixture.componentRef.setInput('task', store.tasks().find((t) => t.id === task.id) ?? task);
    await fixture.whenStable();
  };
  return { fixture, element, row, press, store, task };
}

describe('TaskItem', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.useRealTimers());

  it('muestra título, fecha vencida y etiquetas', async () => {
    const { element } = await setup();
    expect(element.querySelector('.title')!.textContent).toContain('Comprar pan');
    expect(element.querySelector('.due-overdue')!.textContent).toContain('Ayer');
    expect(element.querySelector('.tag')!.textContent).toContain('#casa');
  });

  it('completa con Espacio después de la animación y ofrece deshacer', async () => {
    const { row, store, task } = await setup();
    vi.useFakeTimers();
    row.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(store.tasks()[0].done).toBe(false);
    vi.advanceTimersByTime(500);
    expect(store.tasks()[0].done).toBe(true);

    const toast = TestBed.inject(Toast);
    expect(toast.current()?.actionLabel).toBe('Deshacer');
    toast.runAction();
    expect(store.tasks().find((t) => t.id === task.id)?.done).toBe(false);
  });

  it('cambia la prioridad con P', async () => {
    const { press, store } = await setup();
    await press('p');
    expect(store.tasks()[0].priority).toBe(3);
    await press('p');
    expect(store.tasks()[0].priority).toBe(2);
  });

  it('elimina con Supr y permite deshacer', async () => {
    const { press, store } = await setup();
    await press('Delete');
    expect(store.tasks()).toHaveLength(0);
    TestBed.inject(Toast).runAction();
    expect(store.tasks()).toHaveLength(1);
  });

  it('edita con Enter interpretando lenguaje natural', async () => {
    const { press, element, fixture, store } = await setup();
    // El componente tiene que estar en el documento para poder recibir el foco.
    document.body.appendChild(element);
    await press('Enter');
    const input = element.querySelector<HTMLInputElement>('.edit-input')!;
    expect(document.activeElement).toBe(input);
    input.value = 'Comprar pan integral mañana #super';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();
    expect(store.tasks()[0]).toMatchObject({
      title: 'Comprar pan integral',
      due: '2026-10-30',
      tags: ['casa', 'super'],
    });
  });
});
