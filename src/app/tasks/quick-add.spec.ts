import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Clock } from '../core/clock';
import { TaskStore } from '../core/task-store';
import { STORAGE_KEY } from '../core/task-storage';
import { Toast } from '../core/toast';
import { QuickAdd } from './quick-add';

const TODAY = '2026-10-29';

class FakeClock {
  readonly today = signal(TODAY);
  now() {
    return new Date('2026-10-29T12:00:00');
  }
}

async function setup(inputs: Record<string, unknown> = {}) {
  localStorage.setItem(STORAGE_KEY, '[]');
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: Clock, useClass: FakeClock }],
  });
  const fixture = TestBed.createComponent(QuickAdd);
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
  await fixture.whenStable();

  const element = fixture.nativeElement as HTMLElement;
  const input = element.querySelector('input')!;
  const type = async (text: string) => {
    input.value = text;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  const submit = async () => {
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  };
  const chips = () => [...element.querySelectorAll('.chip')].map((c) => c.textContent!.trim());

  return { fixture, element, input, type, submit, chips, store: TestBed.inject(TaskStore) };
}

describe('QuickAdd', () => {
  beforeEach(() => localStorage.clear());

  it('muestra lo que va a interpretar mientras se escribe', async () => {
    const { type, chips } = await setup();
    await type('Pagar la luz mañana 18hs #casa !alta');
    expect(chips()).toEqual(['Mañana', '18:00', '#casa', 'Alta']);
  });

  it('crea la tarea interpretada y limpia el campo', async () => {
    const { type, submit, store, input } = await setup();
    await type('Pagar la luz mañana #casa');
    await submit();
    expect(store.tasks()).toEqual([
      expect.objectContaining({ title: 'Pagar la luz', due: '2026-10-30', tags: ['casa'] }),
    ]);
    expect(input.value).toBe('');
  });

  it('ignora texto vacío', async () => {
    const { type, submit, store } = await setup();
    await type('   ');
    await submit();
    expect(store.tasks()).toEqual([]);
  });

  it('aplica los valores por defecto de la vista', async () => {
    const { type, submit, store } = await setup({ defaults: { due: TODAY, tags: ['trabajo'] } });
    await type('Informe');
    await submit();
    expect(store.tasks()[0]).toMatchObject({ due: TODAY, tags: ['trabajo'] });
  });

  it('avisa cuando la tarea queda en otra vista', async () => {
    const { type, submit } = await setup({ currentView: 'hoy', defaults: { due: TODAY } });
    await type('Algo el viernes');
    await submit();
    expect(TestBed.inject(Toast).current()?.message).toBe('Agregada a Próximas');
  });
});
