import { Lang, addDays, fromIsoDate, toIsoDate } from './dates';
import { Repeat, firstOccurrence } from './recurrence';
import { Priority } from './task';

export type TokenKind = 'date' | 'time' | 'tag' | 'priority' | 'repeat';

/** Fragmento del texto original que se interpretó (para resaltarlo en el input). */
export interface Token {
  kind: TokenKind;
  start: number;
  end: number;
}

export interface ParsedTask {
  title: string;
  due: string | null;
  time: string | null;
  tags: string[];
  priority: Priority;
  repeat: Repeat | null;
  tokens: Token[];
}

// Límites de palabra que entienden acentos y ñ (`\b` de JS no lo hace).
const B = '(?<![\\p{L}\\p{N}])';
const E = '(?![\\p{L}\\p{N}])';

const stripAccents = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '');
const key = (text: string) => stripAccents(text.toLowerCase());

type DateRule = [pattern: string, resolve: (m: RegExpExecArray, today: string) => string | null];
type RepeatRule = [pattern: string, resolve: (m: RegExpExecArray, today: string) => RepeatMatch];

interface RepeatMatch {
  repeat: Repeat;
  /** Para "todos los lunes": la primera fecha cae en ese día. */
  weekday?: number;
}

interface ParserLocale {
  priorities: Record<string, Priority>;
  timePrefix: string;
  timeSuffix: string;
  repeatRules: RepeatRule[];
  dateRules: DateRule[];
}

// ---------- Español ----------

const ES_WEEKDAYS: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};
const ES_WEEKDAY = '(lunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bado|domingo)';
const ES_MONTHS: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};
/** "desde el 15/11", "a partir del 3 de enero". */
const ES_FROM = '(?:desde\\s+|a\\s+partir\\s+del?\\s+)?';
const ES_UNITS: Record<string, Repeat['unit']> = {
  dia: 'day',
  semana: 'week',
  mes: 'month',
  ano: 'year',
};

const ES: ParserLocale = {
  priorities: { alta: 3, media: 2, baja: 1 },
  timePrefix: 'a\\s+las?\\s+',
  timeSuffix: 'hs|h|am|pm',
  repeatRules: [
    [
      '(?:todos\\s+los\\s+d[ií]as\\s+h[áa]biles|(?:los\\s+)?d[ií]as\\s+de\\s+semana|de\\s+lunes\\s+a\\s+viernes)',
      () => ({ repeat: { unit: 'weekday', every: 1 } }),
    ],
    ['(?:todos\\s+los\\s+d[ií]as|cada\\s+d[ií]a|diariamente|a\\s+diario)', () => daily],
    [
      'cada\\s+(\\d{1,2})\\s+(d[ií]as|semanas|meses|a[ñn]os)',
      (m) => ({
        repeat: { unit: ES_UNITS[key(m[2]).replace(/(es|s)$/, '')], every: Number(m[1]) },
      }),
    ],
    [
      `(?:todos\\s+los|cada)\\s+${ES_WEEKDAY}`,
      (m) => ({ repeat: { unit: 'week', every: 1 }, weekday: ES_WEEKDAYS[key(m[1])] }),
    ],
    ['(?:todas\\s+las\\s+semanas|cada\\s+semana|semanalmente)', () => weekly],
    // Va antes que "cada mes" porque "todos los 10 de cada mes" lo contiene.
    ['(?:todos\\s+los|cada)\\s+(\\d{1,2})\\s+de\\s+cada\\s+mes', (m) => monthly(m[1])],
    [
      '(?:todos\\s+los\\s+meses|cada\\s+mes|mensualmente)(?:\\s+el\\s+(\\d{1,2}))?',
      (m) => monthly(m[1]),
    ],
    ['(?:todos\\s+los\\s+a[ñn]os|cada\\s+a[ñn]o|anualmente)', () => yearly],
  ],
  dateRules: [
    ['pasado\\s+ma[ñn]ana', (_, today) => addDays(today, 2)],
    ['ma[ñn]ana', (_, today) => addDays(today, 1)],
    ['hoy', (_, today) => today],
    [
      'en\\s+(\\d{1,3})\\s+(d[ií]as?|semanas?)',
      (m, today) => addDays(today, Number(m[1]) * (key(m[2]).startsWith('s') ? 7 : 1)),
    ],
    [
      '(?:la\\s+)?(?:semana\\s+que\\s+viene|pr[óo]xima\\s+semana)',
      (_, today) => nextWeekday(today, 1),
    ],
    [
      `(?:el\\s+)?(?:pr[óo]ximo\\s+)?${ES_WEEKDAY}`,
      (m, today) => nextWeekday(today, ES_WEEKDAYS[key(m[1])]),
    ],
    [
      `${ES_FROM}(?:el\\s+)?(\\d{1,2})/(\\d{1,2})(?:/(\\d{2}|\\d{4}))?`,
      (m, today) => resolveDate(today, Number(m[1]), Number(m[2]), m[3]),
    ],
    [
      `${ES_FROM}(?:el\\s+)?(\\d{1,2})\\s+de\\s+(${Object.keys(ES_MONTHS).join('|')})`,
      (m, today) => resolveDate(today, Number(m[1]), ES_MONTHS[key(m[2])]),
    ],
  ],
};

// ---------- English ----------

const EN_WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const EN_WEEKDAY = `(${EN_WEEKDAYS.join('|')})`;
const EN_MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];
// "jan", "january", "sept"... (los nombres completos van primero para que la alternancia no corte "june" en "jun").
const EN_MONTH = `(${EN_MONTHS.join('|')}|${EN_MONTHS.map((m) => m.slice(0, 3)).join('|')}|sept)`;
const enMonth = (name: string) =>
  EN_MONTHS.findIndex((m) => m.startsWith(name.toLowerCase().slice(0, 3))) + 1;
const ORDINAL = '(?:st|nd|rd|th)?';
const EN_UNITS: Record<string, Repeat['unit']> = {
  day: 'day',
  week: 'week',
  month: 'month',
  year: 'year',
};

const EN: ParserLocale = {
  priorities: { high: 3, medium: 2, med: 2, low: 1 },
  timePrefix: 'at\\s+',
  timeSuffix: 'am|pm|h',
  repeatRules: [
    ['(?:every\\s+weekday|weekdays)', () => ({ repeat: { unit: 'weekday', every: 1 } })],
    ['(?:every\\s*day|daily)', () => daily],
    [
      'every\\s+(\\d{1,2})\\s+(days|weeks|months|years)',
      (m) => ({ repeat: { unit: EN_UNITS[m[2].toLowerCase().slice(0, -1)], every: Number(m[1]) } }),
    ],
    [
      `every\\s+${EN_WEEKDAY}`,
      (m) => ({
        repeat: { unit: 'week', every: 1 },
        weekday: EN_WEEKDAYS.indexOf(m[1].toLowerCase()),
      }),
    ],
    ['(?:every\\s+week|weekly)', () => weekly],
    [`(?:every\\s+month|monthly)(?:\\s+on\\s+the\\s+(\\d{1,2})${ORDINAL})?`, (m) => monthly(m[1])],
    ['(?:every\\s+year|yearly|annually)', () => yearly],
  ],
  dateRules: [
    ['(?:the\\s+)?day\\s+after\\s+tomorrow', (_, today) => addDays(today, 2)],
    ['(?:tomorrow|tmrw)', (_, today) => addDays(today, 1)],
    ['(?:today|tonight)', (_, today) => today],
    [
      'in\\s+(\\d{1,3})\\s+(days?|weeks?)',
      (m, today) => addDays(today, Number(m[1]) * (m[2].toLowerCase().startsWith('w') ? 7 : 1)),
    ],
    ['next\\s+week', (_, today) => nextWeekday(today, 1)],
    [
      `(?:on\\s+)?(?:next\\s+)?${EN_WEEKDAY}`,
      (m, today) => nextWeekday(today, EN_WEEKDAYS.indexOf(m[1].toLowerCase())),
    ],
    // Formato de EE.UU.: mes/día.
    [
      '(?:starting\\s+)?(?:on\\s+)?(\\d{1,2})/(\\d{1,2})(?:/(\\d{2}|\\d{4}))?',
      (m, today) => resolveDate(today, Number(m[2]), Number(m[1]), m[3]),
    ],
    [
      `(?:starting\\s+)?(?:on\\s+)?${EN_MONTH}\\s+(\\d{1,2})${ORDINAL}`,
      (m, today) => resolveDate(today, Number(m[2]), enMonth(m[1])),
    ],
    [
      `(?:on\\s+)?(?:the\\s+)?(\\d{1,2})${ORDINAL}\\s+(?:of\\s+)?${EN_MONTH}`,
      (m, today) => resolveDate(today, Number(m[1]), enMonth(m[2])),
    ],
  ],
};

const daily: RepeatMatch = { repeat: { unit: 'day', every: 1 } };
const weekly: RepeatMatch = { repeat: { unit: 'week', every: 1 } };
const yearly: RepeatMatch = { repeat: { unit: 'year', every: 1 } };
function monthly(day?: string): RepeatMatch {
  const n = day ? Number(day) : undefined;
  return {
    repeat: n && n <= 31 ? { unit: 'month', every: 1, day: n } : { unit: 'month', every: 1 },
  };
}

const LOCALES: Record<Lang, ParserLocale> = { es: ES, en: EN };

/**
 * Interpreta una línea en lenguaje natural:
 * `Pagar la luz mañana 18hs #casa !alta` → título, fecha, hora, etiquetas y prioridad.
 * También entiende repeticiones: `Sacar la basura todos los lunes`.
 */
export function parseQuickAdd(input: string, todayIso: string, lang: Lang = 'es'): ParsedTask {
  const locale = LOCALES[lang];
  const result: ParsedTask = {
    title: '',
    due: null,
    time: null,
    tags: [],
    priority: 0,
    repeat: null,
    tokens: [],
  };
  // Un espacio de margen simplifica los límites de palabra. Lo interpretado se reemplaza por
  // espacios del mismo largo, así las posiciones siguen coincidiendo con el texto original.
  let text = ` ${input} `;
  const consume = (kind: TokenKind, index: number, length: number) => {
    result.tokens.push({ kind, start: index - 1, end: index - 1 + length });
    text = text.slice(0, index) + ' '.repeat(length) + text.slice(index + length);
  };

  for (const m of [...text.matchAll(/(?<![\p{L}\p{N}])#([\p{L}\p{N}_-]+)/gu)]) {
    const tag = m[1].toLowerCase();
    if (!result.tags.includes(tag)) result.tags.push(tag);
    consume('tag', m.index, m[0].length);
  }

  const priorityWords = [...Object.keys(locale.priorities), '1', '2', '3'].join('|');
  for (const m of [...text.matchAll(new RegExp(`(?<!\\S)!(${priorityWords})(?!\\S)`, 'giu'))]) {
    const level = m[1].toLowerCase();
    result.priority = locale.priorities[level] ?? ({ '1': 3, '2': 2, '3': 1 } as const)[level]!;
    consume('priority', m.index, m[0].length);
  }

  // Las repeticiones van antes que las fechas: "todos los lunes" contiene "lunes".
  let repeatWeekday: number | undefined;
  for (const [pattern, resolve] of locale.repeatRules) {
    const m = new RegExp(`${B}${pattern}${E}`, 'iu').exec(text);
    if (!m) continue;
    const match = resolve(m, todayIso);
    result.repeat = match.repeat;
    repeatWeekday = match.weekday;
    consume('repeat', m.index, m[0].length);
    break;
  }

  for (const [pattern, resolve] of locale.dateRules) {
    const m = new RegExp(`${B}${pattern}${E}`, 'iu').exec(text);
    if (!m) continue;
    const due = resolve(m, todayIso);
    if (!due) continue;
    result.due = due;
    consume('date', m.index, m[0].length);
    break;
  }

  const timePattern = new RegExp(
    `${B}(${locale.timePrefix})?(\\d{1,2})(?::(\\d{2}))?\\s*(${locale.timeSuffix})?\\.?${E}`,
    'giu',
  );
  for (const m of [...text.matchAll(timePattern)]) {
    const [, prefix, h, min, suffix] = m;
    // Un número suelto ("comprar 3 manzanas") no es una hora.
    if (!prefix && min === undefined && !suffix) continue;
    let hours = Number(h);
    const minutes = min === undefined ? 0 : Number(min);
    const meridiem = suffix?.toLowerCase();
    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
    if (hours > 23 || minutes > 59) continue;
    result.time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    consume('time', m.index, m[0].length);
    break;
  }

  if (result.repeat && !result.due) {
    result.due = firstOccurrence(result.repeat, todayIso, repeatWeekday);
  }
  if (result.repeat?.unit === 'month' && !result.repeat.day) {
    result.repeat = { ...result.repeat, day: fromIsoDate(result.due!).getDate() };
  }

  result.title = text.replace(/\s+/g, ' ').trim();
  result.tokens.sort((a, b) => a.start - b.start);

  // Si no queda texto ("mañana"), lo tomamos literal en vez de crear una tarea sin título.
  if (!result.title) {
    return {
      title: input.trim(),
      due: null,
      time: null,
      tags: [],
      priority: 0,
      repeat: null,
      tokens: [],
    };
  }
  return result;
}

function nextWeekday(todayIso: string, weekday: number): string {
  const current = fromIsoDate(todayIso).getDay();
  const diff = (weekday - current + 7) % 7 || 7;
  return addDays(todayIso, diff);
}

function resolveDate(todayIso: string, day: number, month: number, year?: string): string | null {
  if (month < 1 || month > 12) return null;
  const today = fromIsoDate(todayIso);
  let fullYear = year ? Number(year.length === 2 ? `20${year}` : year) : today.getFullYear();
  const candidate = new Date(fullYear, month - 1, day);
  // Descarta fechas imposibles como 31/02.
  if (candidate.getMonth() !== month - 1 || candidate.getDate() !== day) return null;
  // Sin año explícito, una fecha ya pasada se refiere al año que viene.
  if (!year && toIsoDate(candidate) < todayIso) {
    fullYear += 1;
    candidate.setFullYear(fullYear);
  }
  return toIsoDate(candidate);
}
