import { parseQuickAdd } from './quick-add-parser';

// Jueves 29 de octubre de 2026.
const TODAY = '2026-10-29';
const parse = (input: string) => parseQuickAdd(input, TODAY);

describe('parseQuickAdd', () => {
  it('deja el texto intacto cuando no hay nada para interpretar', () => {
    expect(parse('Comprar pan')).toEqual({
      title: 'Comprar pan',
      due: null,
      time: null,
      tags: [],
      priority: 0,
      repeat: null,
      tokens: [],
    });
  });

  it('interpreta todo junto', () => {
    expect(parse('Pagar la luz mañana 18hs #casa !alta')).toMatchObject({
      title: 'Pagar la luz',
      due: '2026-10-30',
      time: '18:00',
      tags: ['casa'],
      priority: 3,
      repeat: null,
    });
  });

  describe('fechas', () => {
    it.each([
      ['hoy', '2026-10-29'],
      ['mañana', '2026-10-30'],
      ['manana', '2026-10-30'],
      ['pasado mañana', '2026-10-31'],
      ['en 3 días', '2026-11-01'],
      ['en 2 semanas', '2026-11-12'],
      ['la semana que viene', '2026-11-02'],
      ['próxima semana', '2026-11-02'],
      ['el viernes', '2026-10-30'],
      ['el próximo lunes', '2026-11-02'],
      ['miercoles', '2026-11-04'],
      ['el 15/11', '2026-11-15'],
      ['3/1', '2027-01-03'],
      ['10/12/2027', '2027-12-10'],
      ['el 5 de diciembre', '2026-12-05'],
      ['2 de enero', '2027-01-02'],
    ])('"%s" → %s', (phrase, expected) => {
      const result = parse(`Tarea ${phrase}`);
      expect(result.due).toBe(expected);
      expect(result.title).toBe('Tarea');
    });

    it('el mismo día de la semana que hoy apunta a la semana siguiente', () => {
      expect(parse('Gimnasio el jueves').due).toBe('2026-11-05');
    });

    it('ignora fechas imposibles', () => {
      expect(parse('Algo 31/2')).toMatchObject({ due: null, title: 'Algo 31/2' });
    });

    it('no confunde palabras que contienen la fecha', () => {
      expect(parse('Tapar el hoyo').due).toBeNull();
    });
  });

  describe('horas', () => {
    it.each([
      ['18hs', '18:00'],
      ['18 hs', '18:00'],
      ['9h', '09:00'],
      ['18:30', '18:30'],
      ['a las 9', '09:00'],
      ['a la 1', '01:00'],
      ['7pm', '19:00'],
      ['12am', '00:00'],
    ])('"%s" → %s', (phrase, expected) => {
      const result = parse(`Reunión ${phrase}`);
      expect(result.time).toBe(expected);
      expect(result.title).toBe('Reunión');
    });

    it('no toma números sueltos como hora', () => {
      expect(parse('Comprar 3 manzanas')).toMatchObject({
        time: null,
        title: 'Comprar 3 manzanas',
      });
    });

    it('ignora horas inválidas', () => {
      expect(parse('Algo 25hs').time).toBeNull();
    });
  });

  describe('etiquetas y prioridad', () => {
    it('acepta varias etiquetas, en minúsculas y sin repetir', () => {
      expect(parse('Informe #Trabajo #año-2026 #trabajo').tags).toEqual(['trabajo', 'año-2026']);
    });

    it.each([
      ['!alta', 3],
      ['!media', 2],
      ['!baja', 1],
      ['!1', 3],
      ['!3', 1],
    ])('"%s" → prioridad %i', (token, expected) => {
      expect(parse(`Algo ${token}`).priority).toBe(expected);
    });

    it('no toma signos de exclamación comunes como prioridad', () => {
      expect(parse('¡Hola!').priority).toBe(0);
    });
  });

  it('si solo hay tokens, usa el texto literal como título', () => {
    expect(parse('mañana')).toMatchObject({ title: 'mañana', due: null });
  });
});

describe('parseQuickAdd: tokens para resaltar', () => {
  it('devuelve la posición exacta de cada parte interpretada, en orden', () => {
    const input = 'Pagar la luz mañana 18hs #casa !alta';
    const { tokens } = parse(input);
    expect(tokens.map((t) => [t.kind, input.slice(t.start, t.end)])).toEqual([
      ['date', 'mañana'],
      ['time', '18hs'],
      ['tag', '#casa'],
      ['priority', '!alta'],
    ]);
  });

  it('no marca nada si el texto queda vacío', () => {
    expect(parse('mañana').tokens).toEqual([]);
  });
});

describe('parseQuickAdd: repeticiones', () => {
  it.each([
    ['todos los días', { unit: 'day', every: 1 }, TODAY],
    ['cada día', { unit: 'day', every: 1 }, TODAY],
    ['días de semana', { unit: 'weekday', every: 1 }, TODAY],
    ['todas las semanas', { unit: 'week', every: 1 }, TODAY],
    ['cada 2 semanas', { unit: 'week', every: 2 }, TODAY],
    ['cada 3 días', { unit: 'day', every: 3 }, TODAY],
    ['todos los lunes', { unit: 'week', every: 1 }, '2026-11-02'],
    ['cada jueves', { unit: 'week', every: 1 }, TODAY],
    ['todos los meses', { unit: 'month', every: 1, day: 29 }, TODAY],
    ['cada mes el 10', { unit: 'month', every: 1, day: 10 }, '2026-11-10'],
    ['todos los 31 de cada mes', { unit: 'month', every: 1, day: 31 }, '2026-10-31'],
    ['todos los años', { unit: 'year', every: 1 }, TODAY],
  ])('"%s"', (phrase, repeat, due) => {
    const result = parse(`Tarea ${phrase}`);
    expect(result.repeat).toEqual(repeat);
    expect(result.due).toBe(due);
    expect(result.title).toBe('Tarea');
  });

  it('respeta una fecha explícita como primera ocurrencia', () => {
    expect(parse('Gimnasio todas las semanas desde el 15/11')).toMatchObject({
      title: 'Gimnasio',
      repeat: { unit: 'week', every: 1 },
      due: '2026-11-15',
    });
  });

  it('combina repetición con hora y etiqueta', () => {
    expect(parse('Sacar la basura todos los lunes 21hs #casa')).toMatchObject({
      title: 'Sacar la basura',
      repeat: { unit: 'week', every: 1 },
      due: '2026-11-02',
      time: '21:00',
      tags: ['casa'],
    });
  });
});

describe('parseQuickAdd en inglés', () => {
  const en = (input: string) => parseQuickAdd(input, TODAY, 'en');

  it('interpreta todo junto', () => {
    expect(en('Pay the electricity bill tomorrow 6pm #home !high')).toMatchObject({
      title: 'Pay the electricity bill',
      due: '2026-10-30',
      time: '18:00',
      tags: ['home'],
      priority: 3,
    });
  });

  it.each([
    ['today', '2026-10-29'],
    ['tomorrow', '2026-10-30'],
    ['the day after tomorrow', '2026-10-31'],
    ['in 3 days', '2026-11-01'],
    ['in 2 weeks', '2026-11-12'],
    ['next week', '2026-11-02'],
    ['on friday', '2026-10-30'],
    ['next monday', '2026-11-02'],
    ['11/15', '2026-11-15'],
    ['nov 15', '2026-11-15'],
    ['November 15th', '2026-11-15'],
    ['the 3rd of january', '2027-01-03'],
  ])('fecha "%s" → %s', (phrase, expected) => {
    expect(en(`Task ${phrase}`)).toMatchObject({ due: expected, title: 'Task' });
  });

  it.each([
    ['6pm', '18:00'],
    ['at 9', '09:00'],
    ['18:30', '18:30'],
    ['12am', '00:00'],
  ])('hora "%s" → %s', (phrase, expected) => {
    expect(en(`Meeting ${phrase}`)).toMatchObject({ time: expected, title: 'Meeting' });
  });

  it.each([
    ['every day', { unit: 'day', every: 1 }],
    ['daily', { unit: 'day', every: 1 }],
    ['every weekday', { unit: 'weekday', every: 1 }],
    ['every monday', { unit: 'week', every: 1 }],
    ['weekly', { unit: 'week', every: 1 }],
    ['every 2 weeks', { unit: 'week', every: 2 }],
    ['every month on the 10th', { unit: 'month', every: 1, day: 10 }],
    ['yearly', { unit: 'year', every: 1 }],
  ])('repetición "%s"', (phrase, repeat) => {
    expect(en(`Task ${phrase}`)).toMatchObject({ repeat, title: 'Task' });
  });

  it.each([
    ['!high', 3],
    ['!medium', 2],
    ['!low', 1],
  ])('prioridad "%s"', (token, expected) => {
    expect(en(`Task ${token}`).priority).toBe(expected);
  });

  it('no interpreta palabras en español', () => {
    expect(en('Comprar pan mañana').due).toBeNull();
  });
});

// Si cambia alguno de estos resultados, hay que actualizar la tabla del README.
describe('parseQuickAdd: ejemplos del README', () => {
  it.each([
    [
      'es',
      'Pagar la luz mañana 18hs #casa !alta',
      { title: 'Pagar la luz', due: '2026-10-30', time: '18:00', tags: ['casa'], priority: 3 },
    ],
    [
      'es',
      'Sacar la basura todos los lunes 21hs',
      {
        title: 'Sacar la basura',
        due: '2026-11-02',
        time: '21:00',
        repeat: { unit: 'week', every: 1 },
      },
    ],
    [
      'es',
      'Pagar alquiler cada mes el 10',
      { title: 'Pagar alquiler', due: '2026-11-10', repeat: { unit: 'month', every: 1, day: 10 } },
    ],
    [
      'es',
      'Gimnasio días de semana a las 7',
      { title: 'Gimnasio', due: TODAY, time: '07:00', repeat: { unit: 'weekday', every: 1 } },
    ],
    [
      'en',
      'Call Ana tomorrow 10am #work !high',
      { title: 'Call Ana', due: '2026-10-30', time: '10:00', tags: ['work'], priority: 3 },
    ],
  ] as const)('[%s] "%s"', (lang, input, expected) => {
    expect(parseQuickAdd(input, TODAY, lang)).toMatchObject(expected);
  });
});
