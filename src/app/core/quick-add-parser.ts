import { addDays, fromIsoDate, toIsoDate } from './dates';
import { Priority } from './task';

export interface ParsedTask {
  title: string;
  due: string | null;
  time: string | null;
  tags: string[];
  priority: Priority;
}

// Límites de palabra que entienden acentos y ñ (`\b` de JS no lo hace).
const B = '(?<![\\p{L}\\p{N}])';
const E = '(?![\\p{L}\\p{N}])';

const WEEKDAYS: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

const MONTHS: Record<string, number> = {
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

const PRIORITIES: Record<string, Priority> = { alta: 3, '1': 3, media: 2, '2': 2, baja: 1, '3': 1 };

const stripAccents = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '');

type DateRule = [
  pattern: string,
  resolve: (match: RegExpExecArray, today: string) => string | null,
];

const DATE_RULES: DateRule[] = [
  ['pasado\\s+ma[ñn]ana', (_, today) => addDays(today, 2)],
  ['ma[ñn]ana', (_, today) => addDays(today, 1)],
  ['hoy', (_, today) => today],
  [
    'en\\s+(\\d{1,3})\\s+(d[ií]as?|semanas?)',
    (m, today) => addDays(today, Number(m[1]) * (m[2].toLowerCase().startsWith('s') ? 7 : 1)),
  ],
  [
    '(?:la\\s+)?(?:semana\\s+que\\s+viene|pr[óo]xima\\s+semana)',
    (_, today) => nextWeekday(today, 1),
  ],
  [
    '(?:el\\s+)?(?:pr[óo]ximo\\s+)?(lunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bado|domingo)',
    (m, today) => nextWeekday(today, WEEKDAYS[stripAccents(m[1].toLowerCase())]),
  ],
  [
    '(?:el\\s+)?(\\d{1,2})/(\\d{1,2})(?:/(\\d{2}|\\d{4}))?',
    (m, today) => resolveDate(today, Number(m[1]), Number(m[2]), m[3]),
  ],
  [
    `(?:el\\s+)?(\\d{1,2})\\s+de\\s+(${Object.keys(MONTHS).join('|')})`,
    (m, today) => resolveDate(today, Number(m[1]), MONTHS[m[2].toLowerCase()]),
  ],
];

const TIME_PATTERN = new RegExp(
  `${B}(a\\s+las?\\s+)?(\\d{1,2})(?::(\\d{2}))?\\s*(hs|h|am|pm)?\\.?${E}`,
  'giu',
);

/**
 * Interpreta una línea en lenguaje natural:
 * `Pagar la luz mañana 18hs #casa !alta` → título, fecha, hora, etiquetas y prioridad.
 */
export function parseQuickAdd(input: string, todayIso: string): ParsedTask {
  const result: ParsedTask = { title: '', due: null, time: null, tags: [], priority: 0 };
  let text = ` ${input} `;

  text = text.replace(/(?<![\p{L}\p{N}])#([\p{L}\p{N}_-]+)/gu, (_, tag: string) => {
    const normalized = tag.toLowerCase();
    if (!result.tags.includes(normalized)) result.tags.push(normalized);
    return ' ';
  });

  text = text.replace(/(?<!\S)!(alta|media|baja|[123])(?!\S)/giu, (_, level: string) => {
    result.priority = PRIORITIES[level.toLowerCase()];
    return ' ';
  });

  for (const [pattern, resolve] of DATE_RULES) {
    const match = new RegExp(`${B}${pattern}${E}`, 'iu').exec(text);
    if (!match) continue;
    const due = resolve(match, todayIso);
    if (!due) continue;
    result.due = due;
    text = text.slice(0, match.index) + ' ' + text.slice(match.index + match[0].length);
    break;
  }

  text = text.replace(
    TIME_PATTERN,
    (whole, prefix?: string, h?: string, m?: string, suffix?: string) => {
      // Un número suelto ("comprar 3 manzanas") no es una hora.
      if (result.time || (!prefix && m === undefined && !suffix)) return whole;
      let hours = Number(h);
      const minutes = m === undefined ? 0 : Number(m);
      const meridiem = suffix?.toLowerCase();
      if (meridiem === 'pm' && hours < 12) hours += 12;
      if (meridiem === 'am' && hours === 12) hours = 0;
      if (hours > 23 || minutes > 59) return whole;
      result.time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      return ' ';
    },
  );

  result.title = text.replace(/\s+/g, ' ').trim();

  // Si no queda texto ("mañana"), lo tomamos literal en vez de crear una tarea sin título.
  if (!result.title) {
    return { title: input.trim(), due: null, time: null, tags: [], priority: 0 };
  }
  return result;
}

function nextWeekday(todayIso: string, weekday: number): string {
  const current = fromIsoDate(todayIso).getDay();
  const diff = (weekday - current + 7) % 7 || 7;
  return addDays(todayIso, diff);
}

function resolveDate(todayIso: string, day: number, month: number, year?: string): string | null {
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
