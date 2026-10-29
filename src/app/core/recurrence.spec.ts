import { firstOccurrence, nextOccurrence } from './recurrence';

// Jueves 29 de octubre de 2026.
const TODAY = '2026-10-29';

describe('nextOccurrence', () => {
  it.each([
    ['día', { unit: 'day', every: 1 } as const, '2026-10-29', '2026-10-30'],
    ['cada 3 días', { unit: 'day', every: 3 } as const, '2026-10-29', '2026-11-01'],
    ['semana', { unit: 'week', every: 1 } as const, '2026-10-29', '2026-11-05'],
    ['día hábil desde viernes', { unit: 'weekday', every: 1 } as const, '2026-10-30', '2026-11-02'],
    ['mes', { unit: 'month', every: 1, day: 29 } as const, '2026-10-29', '2026-11-29'],
    ['año', { unit: 'year', every: 1 } as const, '2026-10-29', '2027-10-29'],
  ])('%s', (_, repeat, due, expected) => {
    expect(nextOccurrence(due, repeat, TODAY)).toBe(expected);
  });

  it('el 31 cae en el último día de los meses cortos, sin "derivar"', () => {
    const repeat = { unit: 'month', every: 1, day: 31 } as const;
    expect(nextOccurrence('2027-01-31', repeat, '2027-01-31')).toBe('2027-02-28');
    expect(nextOccurrence('2027-02-28', repeat, '2027-02-28')).toBe('2027-03-31');
  });

  it('el 29 de febrero pasa al 28 en años no bisiestos', () => {
    expect(nextOccurrence('2028-02-29', { unit: 'year', every: 1 }, '2028-02-29')).toBe(
      '2029-02-28',
    );
  });

  it('una tarea atrasada salta a la próxima fecha futura', () => {
    expect(nextOccurrence('2026-10-01', { unit: 'week', every: 1 }, TODAY)).toBe('2026-11-05');
  });
});

describe('firstOccurrence', () => {
  it('un día de la semana fijo empieza hoy si coincide, o el próximo', () => {
    const weekly = { unit: 'week', every: 1 } as const;
    expect(firstOccurrence(weekly, TODAY, 4)).toBe(TODAY);
    expect(firstOccurrence(weekly, TODAY, 1)).toBe('2026-11-02');
  });

  it('los días hábiles no empiezan un fin de semana', () => {
    expect(firstOccurrence({ unit: 'weekday', every: 1 }, '2026-10-31')).toBe('2026-11-02');
  });

  it('un día del mes ya pasado empieza el mes siguiente', () => {
    expect(firstOccurrence({ unit: 'month', every: 1, day: 10 }, TODAY)).toBe('2026-11-10');
    expect(firstOccurrence({ unit: 'month', every: 1, day: 30 }, TODAY)).toBe('2026-10-30');
  });
});
