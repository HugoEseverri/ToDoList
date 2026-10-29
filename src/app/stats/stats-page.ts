import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Clock } from '../core/clock';
import { addDays, capitalize, formatLongDate, fromIsoDate } from '../core/dates';
import {
  HeatmapCell,
  bestStreak,
  byWeekday,
  completedThisWeek,
  currentStreak,
  heatmap,
  topTags,
  totalCompleted,
} from '../core/stats';
import { TaskStore } from '../core/task-store';
import { I18n } from '../i18n/i18n';
import { Icon } from '../ui/icon';

const WEEKS = 24;
/** Separación mínima entre etiquetas de mes, en columnas, para que no se pisen. */
const MONTH_LABEL_GAP = 3;

interface Tip {
  text: string;
  x: number;
  y: number;
}

@Component({
  selector: 'app-stats-page',
  imports: [Icon],
  templateUrl: './stats-page.html',
  styleUrl: './stats-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsPage {
  private readonly store = inject(TaskStore);
  private readonly clock = inject(Clock);
  protected readonly i18n = inject(I18n);
  protected readonly t = this.i18n.t;
  protected readonly weeks = WEEKS;

  protected readonly tiles = computed(() => {
    const log = this.store.log();
    const today = this.clock.today();
    const days = (n: number) => this.i18n.plural('stats.days', n);
    return [
      {
        label: this.t('stats.streak'),
        value: days(currentStreak(log, today)),
        icon: 'flame' as const,
      },
      {
        label: this.t('stats.bestStreak'),
        value: days(bestStreak(log)),
        icon: 'sparkles' as const,
      },
      {
        label: this.t('stats.thisWeek'),
        value: String(completedThisWeek(log, today)),
        icon: 'calendar' as const,
      },
      {
        label: this.t('stats.total'),
        value: String(totalCompleted(log)),
        icon: 'circle-check' as const,
      },
    ];
  });

  protected readonly hasActivity = computed(() => totalCompleted(this.store.log()) > 0);
  protected readonly columns = computed(() => heatmap(this.store.log(), this.clock.today(), WEEKS));

  /** Etiquetas de mes sobre la primera columna de cada mes. */
  protected readonly monthLabels = computed(() => {
    const locale = this.i18n.lang() === 'es' ? 'es-AR' : 'en-US';
    const labels: string[] = [];
    let lastLabeled = -MONTH_LABEL_GAP;
    let previousMonth = -1;
    this.columns().forEach((column, i) => {
      const month = fromIsoDate(column[0].date).getMonth();
      const show = month !== previousMonth && i - lastLabeled >= MONTH_LABEL_GAP;
      labels.push(
        show
          ? fromIsoDate(column[0].date)
              .toLocaleDateString(locale, { month: 'short' })
              .replace('.', '')
          : '',
      );
      if (show) lastLabeled = i;
      previousMonth = month;
    });
    return labels;
  });

  /** Iniciales de lunes a domingo según el idioma. */
  protected readonly weekdayNames = computed(() => {
    const locale = this.i18n.lang() === 'es' ? 'es-AR' : 'en-US';
    // 2024-01-01 fue lunes.
    return Array.from({ length: 7 }, (_, i) =>
      capitalize(
        fromIsoDate(addDays('2024-01-01', i)).toLocaleDateString(locale, { weekday: 'short' }),
      ).replace('.', ''),
    );
  });

  protected readonly weekdays = computed(() => {
    const totals = byWeekday(this.store.log());
    const max = Math.max(1, ...totals);
    return totals.map((count, i) => ({ name: this.weekdayNames()[i], count, ratio: count / max }));
  });

  protected readonly tags = computed(() => {
    const tags = topTags(this.store.tasks());
    const max = Math.max(1, ...tags.map((t) => t.count));
    return tags.map((t) => ({ ...t, ratio: t.count / max }));
  });

  protected readonly tip = signal<Tip | null>(null);

  protected cellLabel(cell: HeatmapCell): string {
    const date = formatLongDate(cell.date, this.i18n.lang());
    if (!cell.count) return this.t('stats.cell.zero', { date });
    return this.i18n.plural('stats.cell', cell.count, { date });
  }

  protected showTip(event: Event, text: string): void {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    this.tip.set({ text, x: rect.left + rect.width / 2, y: rect.top });
  }

  protected hideTip(): void {
    this.tip.set(null);
  }
}
