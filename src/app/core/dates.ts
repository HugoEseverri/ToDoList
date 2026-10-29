/** Utilidades de fechas locales. Las fechas se manejan como `YYYY-MM-DD` para evitar problemas de zona horaria. */

const pad = (n: number) => String(n).padStart(2, '0');

export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  const date = fromIsoDate(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const ms = fromIsoDate(toIso).getTime() - fromIsoDate(fromIso).getTime();
  return Math.round(ms / 86_400_000);
}

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const WEEKDAYS_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MONTHS_SHORT = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

/** "Hoy", "Mañana", "Ayer", "Viernes" (dentro de la semana) o "Vie 15 nov". */
export function formatRelativeDay(iso: string, todayIso: string): string {
  const diff = daysBetween(todayIso, iso);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  if (diff === -1) return 'Ayer';
  const date = fromIsoDate(iso);
  if (diff > 1 && diff < 7) return capitalize(WEEKDAYS[date.getDay()]);
  const sameYear = date.getFullYear() === fromIsoDate(todayIso).getFullYear();
  const base = `${capitalize(WEEKDAYS_SHORT[date.getDay()])} ${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
  return sameYear ? base : `${base} ${date.getFullYear()}`;
}

/** "29 de octubre". */
export function formatDayMonth(iso: string): string {
  const date = fromIsoDate(iso);
  return `${date.getDate()} de ${date.toLocaleDateString('es-AR', { month: 'long' })}`;
}

/** "miércoles 29 de octubre". */
export function formatLongDate(iso: string): string {
  return `${WEEKDAYS[fromIsoDate(iso).getDay()]} ${formatDayMonth(iso)}`;
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
