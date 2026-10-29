import { TestBed } from '@angular/core/testing';
import { TaskDetailState } from '../core/task-detail-state';
import { TaskStore } from '../core/task-store';
import { Toast } from '../core/toast';
import { parsed, resetStorage, testProviders } from '../testing/test-helpers';
import { TaskItem } from './task-item';

async function setup(extra: Parameters<typeof parsed>[1] = {}) {
  TestBed.configureTestingModule({ providers: testProviders });
  const store = TestBed.inject(TaskStore);
  const task = store.add(parsed('Comprar pan', { due: '2026-10-28', tags: ['casa'], ...extra }));

  const fixture = TestBed.createComponent(TaskItem);
  fixture.componentRef.setInput('task', task);
  await fixture.whenStable();

  const element = fixture.nativeElement as HTMLElement;
  // El componente tiene que estar en el documento para poder recibir el foco.
  document.body.appendChild(element);
  const row = element.querySelector<HTMLElement>('[data-task-row]')!;
  const refresh = async () => {
    fixture.componentRef.setInput('task', store.get(task.id) ?? task);
    await fixture.whenStable();
  };
  const press = async (key: string) => {
    row.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    await refresh();
  };
  return { fixture, element, row, press, refresh, store, task };
}

describe('TaskItem', () => {
  beforeEach(() => resetStorage());
  afterEach(() => vi.useRealTimers());

  it('muestra título, fecha vencida y etiquetas', async () => {
    const { element } = await setup();
    expect(element.querySelector('.title')!.textContent).toContain('Comprar pan');
    expect(element.querySelector('.due-overdue')!.textContent).toContain('Ayer');
    expect(element.querySelector('.tag')!.textContent).toContain('#casa');
  });

  it('muestra repetición y progreso de subtareas', async () => {
    const { element, store, task, refresh } = await setup({
      repeat: { unit: 'day', every: 1 },
    });
    store.addSubtask(task.id, 'Uno');
    store.addSubtask(task.id, 'Dos');
    await refresh();
    const meta = element.querySelector('.meta')!.textContent!;
    expect(meta).toContain('Todos los días');
    expect(meta).toContain('0/2');
  });

  it('completa con Espacio después de la animación y ofrece deshacer', async () => {
    const { row, store, task } = await setup();
    vi.useFakeTimers();
    row.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(store.get(task.id)!.done).toBe(false);
    vi.advanceTimersByTime(500);
    expect(store.get(task.id)!.done).toBe(true);

    const toast = TestBed.inject(Toast);
    expect(toast.current()?.actionLabel).toBe('Deshacer');
    toast.runAction();
    expect(store.get(task.id)!.done).toBe(false);
  });

  it('cambia la prioridad con P', async () => {
    const { press, store, task } = await setup();
    await press('p');
    expect(store.get(task.id)!.priority).toBe(3);
    await press('p');
    expect(store.get(task.id)!.priority).toBe(2);
  });

  it('elimina con Supr y permite deshacer', async () => {
    const { press, store } = await setup();
    await press('Delete');
    expect(store.tasks()).toHaveLength(0);
    TestBed.inject(Toast).runAction();
    expect(store.tasks()).toHaveLength(1);
  });

  it('abre el detalle con Enter o con un clic', async () => {
    const { press, row, task } = await setup();
    const detail = TestBed.inject(TaskDetailState);
    await press('Enter');
    expect(detail.openId()).toBe(task.id);
    detail.close();
    row.querySelector<HTMLElement>('.title')!.click();
    expect(detail.openId()).toBe(task.id);
  });

  it('un clic en el checkbox no abre el detalle', async () => {
    const { row } = await setup();
    vi.useFakeTimers();
    row.querySelector<HTMLElement>('.check')!.click();
    expect(TestBed.inject(TaskDetailState).openId()).toBeNull();
  });

  it('edita el título con E interpretando lenguaje natural', async () => {
    const { press, element, fixture, store, task } = await setup();
    await press('e');
    const input = element.querySelector<HTMLInputElement>('.edit-input')!;
    expect(document.activeElement).toBe(input);
    input.value = 'Comprar pan integral mañana #super';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();
    expect(store.get(task.id)).toMatchObject({
      title: 'Comprar pan integral',
      due: '2026-10-30',
      tags: ['casa', 'super'],
    });
  });
});
