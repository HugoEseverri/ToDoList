import { DOCUMENT, Injectable, effect, inject, signal } from '@angular/core';
import { Lang, capitalize, formatDayMonth, weekdayName } from '../core/dates';
import { Repeat } from '../core/recurrence';
import { MESSAGES, MessageKey } from './messages';

const STORAGE_KEY = 'hecho.lang';

type Params = Record<string, string | number>;
/** Claves con variantes `.one` / `.other` para singular y plural. */
type PluralKey = {
  [K in MessageKey]: K extends `${infer Base}.one` ? Base : never;
}[MessageKey];

/** Traducciones en tiempo de ejecución: el idioma es un signal, así la interfaz cambia al instante. */
@Injectable({ providedIn: 'root' })
export class I18n {
  private readonly document = inject(DOCUMENT);
  readonly lang = signal<Lang>(readStoredLang());

  constructor() {
    effect(() => {
      const lang = this.lang();
      this.document.documentElement.lang = lang;
      try {
        localStorage.setItem(STORAGE_KEY, lang);
      } catch {
        // Sin acceso a storage: el idioma solo dura la sesión.
      }
    });
  }

  /** Arrow function para poder pasarla a templates como `t('clave')`. */
  readonly t = (key: MessageKey, params?: Params): string =>
    interpolate(MESSAGES[this.lang()][key], params);

  readonly plural = (key: PluralKey, n: number, params?: Params): string =>
    this.t(`${key}.${n === 1 ? 'one' : 'other'}` as MessageKey, { n, ...params });

  toggle(): void {
    this.lang.update((lang) => (lang === 'es' ? 'en' : 'es'));
  }

  repeatLabel(repeat: Repeat, due: string | null): string {
    const lang = this.lang();
    if (repeat.every > 1 && repeat.unit !== 'weekday') {
      return this.t(`repeat.every.${repeat.unit}`, { n: repeat.every });
    }
    if (repeat.unit === 'week' && due) {
      const weekday = weekdayName(due, lang);
      // "Todos los lunes": en español solo sábado y domingo cambian en plural.
      return this.t('repeat.weekOn', {
        weekday: lang === 'es' ? weekday.replace(/o$/, 'os') : capitalize(weekday),
      });
    }
    if (repeat.unit === 'month' && repeat.day) {
      return this.t('repeat.monthOn', {
        day: lang === 'es' ? repeat.day : ordinal(repeat.day),
      });
    }
    return this.t(`repeat.${repeat.unit}` as MessageKey);
  }

  formatDayMonth(iso: string): string {
    return formatDayMonth(iso, this.lang());
  }
}

function interpolate(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${suffix}`;
}

function readStoredLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'es' || stored === 'en') return stored;
  } catch {
    // Sin acceso a storage.
  }
  return typeof navigator !== 'undefined' && !navigator.language.toLowerCase().startsWith('es')
    ? 'en'
    : 'es';
}
