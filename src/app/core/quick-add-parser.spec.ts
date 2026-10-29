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
    });
  });

  it('interpreta todo junto', () => {
    expect(parse('Pagar la luz mañana 18hs #casa !alta')).toEqual({
      title: 'Pagar la luz',
      due: '2026-10-30',
      time: '18:00',
      tags: ['casa'],
      priority: 3,
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
