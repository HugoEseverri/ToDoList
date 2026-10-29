import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TaskStore } from '../core/task-store';
import { Toast } from '../core/toast';
import { I18n } from '../i18n/i18n';
import { TODAY, resetStorage, testProviders } from '../testing/test-helpers';
import { QuickAdd } from './quick-add';

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.configureTestingModule({ providers: [provideRouter([]), ...testProviders] });
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
  const highlighted = () =>
    [...element.querySelectorAll('.mirror .token')].map((t) => [t.className, t.textContent]);

  return {
    fixture,
    element,
    input,
    type,
    submit,
    chips,
    highlighted,
    store: TestBed.inject(TaskStore),
  };
}

describe('QuickAdd', () => {
  beforeEach(() => resetStorage());

  it('muestra lo que va a interpretar mientras se escribe', async () => {
    const { type, chips } = await setup();
    await type('Pagar la luz mañana 18hs #casa !alta');
    expect(chips()).toEqual(['Mañana', '18:00', '#casa', 'Alta']);
  });

  it('resalta cada parte reconocida dentro del texto', async () => {
    const { type, highlighted, element } = await setup();
    await type('Pagar la luz mañana #casa !alta');
    expect(highlighted()).toEqual([
      ['token token-date', 'mañana'],
      ['token token-tag', '#casa'],
      ['token token-priority-3', '!alta'],
    ]);
    // La capa de resaltado reproduce el texto completo, carácter por carácter.
    expect(element.querySelector('.mirror')!.textContent).toBe('Pagar la luz mañana #casa !alta');
  });

  it('muestra la repetición', async () => {
    const { type, chips } = await setup();
    await type('Sacar la basura todos los lunes');
    expect(chips()).toEqual(['Lunes', 'Todos los lunes']);
  });

  it('crea la tarea interpretada y limpia el campo', async () => {
    const { type, submit, store, input } = await setup();
    await type('Pagar la luz mañana #casa');
    await submit();
    expect(store.tasks()).toEqual([
      expect.objectContaining({ title: 'Pagar la luz', due: '2026-10-30', tags: ['casa'] }),
    ]);
    expect(store.tasks()[0]).not.toHaveProperty('tokens');
    expect(input.value).toBe('');
  });

  it('vacía el campo aunque se envíe antes de que la vista se actualice', async () => {
    const { input, element, fixture, store } = await setup();
    input.value = 'Rápida';
    input.dispatchEvent(new Event('input'));
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(store.tasks().map((t) => t.title)).toEqual(['Rápida']);
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

  it('interpreta en inglés cuando ese es el idioma elegido', async () => {
    const { type, chips, fixture } = await setup();
    TestBed.inject(I18n).lang.set('en');
    await fixture.whenStable();
    await type('Call Ana tomorrow 10am #work !high');
    expect(chips()).toEqual(['Tomorrow', '10:00', '#work', 'High']);
  });
});
