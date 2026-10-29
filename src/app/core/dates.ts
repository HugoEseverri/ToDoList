/** Utilidades de fechas locales. Las fechas se manejan como `YYYY-MM-DD` para evitar problemas de zona horaria. */

export type Lang = 'es' | 'en';

const LOCALES: Record<Lang, string> = { es: 'es-AR', en: 'en-US' };
const RELATIVE: Record<Lang, [yesterday: string, today: string, tomorrow: string]> = {
  es: ['Ayer', 'Hoy', 'Mañana'],
  en: ['Yesterday', 'Today', 'Tomorrow'],
};

const pad = (n: number) => String(n).padStart(2, '0');

export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Día local (`YYYY-MM-DD`) de un instante guardado con `toISOString()` (que está en UTC). */
export function localDay(isoDateTime: string): string {
  return toIsoDate(new Date(isoDateTime));
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

const format = (iso: string, lang: Lang, options: Intl.DateTimeFormatOptions) =>
  fromIsoDate(iso).toLocaleDateString(LOCALES[lang], options).replace(/\./g, '');

export function weekdayName(iso: string, lang: Lang = 'es'): string {
  return format(iso, lang, { weekday: 'long' });
}

/** "Hoy", "Mañana", "Ayer", "Viernes" (dentro de la semana) o "Vie 15 nov". */
export function formatRelativeDay(iso: string, todayIso: string, lang: Lang = 'es'): string {
  const diff = daysBetween(todayIso, iso);
  if (diff >= -1 && diff <= 1) return RELATIVE[lang][diff + 1];
  if (diff > 1 && diff < 7) return capitalize(weekdayName(iso, lang));
  const sameYear = fromIsoDate(iso).getFullYear() === fromIsoDate(todayIso).getFullYear();
  const options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' };
  return capitalize(
    format(iso, lang, sameYear ? options : { ...options, year: 'numeric' }).replace(/,/g, ''),
  );
}

/** "29 de octubre" / "October 29". */
export function formatDayMonth(iso: string, lang: Lang = 'es'): string {
  return format(iso, lang, { day: 'numeric', month: 'long' });
}

/** "jueves 29 de octubre" / "Thursday, October 29". */
export function formatLongDate(iso: string, lang: Lang = 'es'): string {
  return format(iso, lang, { weekday: 'long', day: 'numeric', month: 'long' }).replace(
    /,(?= \d)/,
    '',
  );
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
