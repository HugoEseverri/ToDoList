import { addDays, fromIsoDate, toIsoDate } from './dates';

/** `weekday` = de lunes a viernes. */
export type RepeatUnit = 'day' | 'weekday' | 'week' | 'month' | 'year';

export interface Repeat {
  unit: RepeatUnit;
  every: number;
  /** Para repeticiones mensuales: día del mes elegido (evita que el 31 "derive" al 28). */
  day?: number;
}

const isWeekend = (iso: string) => [0, 6].includes(fromIsoDate(iso).getDay());

/** Siguiente fecha de una tarea repetitiva, siempre posterior a hoy. */
export function nextOccurrence(due: string, repeat: Repeat, today: string): string {
  let next = advance(due, repeat);
  while (next <= today) next = advance(next, repeat);
  return next;
}

function advance(iso: string, { unit, every, day }: Repeat): string {
  switch (unit) {
    case 'day':
      return addDays(iso, every);
    case 'week':
      return addDays(iso, 7 * every);
    case 'weekday': {
      let next = addDays(iso, 1);
      while (isWeekend(next)) next = addDays(next, 1);
      return next;
    }
    case 'month':
      return addMonths(iso, every, day ?? fromIsoDate(iso).getDate());
    case 'year': {
      const date = fromIsoDate(iso);
      return addMonths(iso, 12 * every, date.getDate());
    }
  }
}

/** Suma meses respetando el día pedido; si el mes es más corto, usa su último día. */
function addMonths(iso: string, months: number, day: number): string {
  const date = fromIsoDate(iso);
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return toIsoDate(target);
}

/** Primera fecha de una repetición que empieza hoy (ej.: "todos los lunes" → el próximo lunes, o hoy si es lunes). */
export function firstOccurrence(repeat: Repeat, today: string, weekday?: number): string {
  if (weekday !== undefined) {
    const diff = (weekday - fromIsoDate(today).getDay() + 7) % 7;
    return addDays(today, diff);
  }
  if (repeat.unit === 'weekday') {
    let next = today;
    while (isWeekend(next)) next = addDays(next, 1);
    return next;
  }
  if (repeat.unit === 'month' && repeat.day) {
    const date = fromIsoDate(today);
    const thisMonth = addMonths(
      toIsoDate(new Date(date.getFullYear(), date.getMonth(), 1)),
      0,
      repeat.day,
    );
    return thisMonth >= today ? thisMonth : addMonths(thisMonth, 1, repeat.day);
  }
  return today;
}
