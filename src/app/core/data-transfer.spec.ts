import { TestBed } from '@angular/core/testing';
import { parsed, resetStorage, testProviders } from '../testing/test-helpers';
import { DataTransfer } from './data-transfer';
import { TaskStore } from './task-store';
import { Toast } from './toast';

const file = (content: string) => new Blob([content], { type: 'application/json' });

function setup() {
  TestBed.configureTestingModule({ providers: testProviders });
  return {
    data: TestBed.inject(DataTransfer),
    store: TestBed.inject(TaskStore),
    toast: TestBed.inject(Toast),
  };
}

describe('DataTransfer', () => {
  beforeEach(() => resetStorage());

  it('importa el formato exportado y permite deshacer', async () => {
    const { data, store, toast } = setup();
    store.add(parsed('Existente'));
    const exported = { app: 'hecho', version: 1, tasks: [{ title: 'Importada', tags: ['x'] }] };
    await data.importFile(file(JSON.stringify(exported)));
    expect(store.tasks().map((t) => t.title)).toEqual(['Importada', 'Existente']);
    expect(toast.current()?.message).toBe('Se importó 1 tarea');
    toast.runAction();
    expect(store.tasks().map((t) => t.title)).toEqual(['Existente']);
  });

  it('acepta una lista suelta y descarta lo que no es una tarea', async () => {
    const { data, store } = setup();
    await data.importFile(file(JSON.stringify([{ title: 'Válida' }, { foo: 1 }, 'texto', null])));
    expect(store.tasks().map((t) => t.title)).toEqual(['Válida']);
  });

  it('avisa si el archivo no es JSON o no tiene tareas', async () => {
    const { data, toast } = setup();
    await data.importFile(file('no es json'));
    expect(toast.current()?.message).toBe('No se pudo leer el archivo');
    await data.importFile(file('{"tasks": []}'));
    expect(toast.current()?.message).toBe('El archivo no tiene tareas válidas');
  });

  it('agrega las tareas de ejemplo', () => {
    const { data, store } = setup();
    data.addExamples();
    expect(store.tasks().length).toBeGreaterThan(5);
  });
});
