import { addDays, fromIsoDate } from './dates';
import { Task } from './task';
import { CompletionLog } from './task-storage';

export interface HeatmapCell {
  date: string;
  count: number;
  /** 0 = sin actividad, 1–4 = intensidad relativa al día más activo. */
  level: 0 | 1 | 2 | 3 | 4;
}

/** Lunes de la semana de una fecha. */
export function startOfWeek(iso: string): string {
  const day = fromIsoDate(iso).getDay();
  return addDays(iso, -((day + 6) % 7));
}

/** Días seguidos con al menos una tarea completada. Si hoy todavía no hay, la racha sigue viva desde ayer. */
export function currentStreak(log: CompletionLog, today: string): number {
  let day = log[today] ? today : addDays(today, -1);
  let streak = 0;
  while (log[day]) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}

export function bestStreak(log: CompletionLog): number {
  const days = Object.keys(log)
    .filter((d) => log[d] > 0)
    .sort();
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of days) {
    run = previous && addDays(previous, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return best;
}

export function completedThisWeek(log: CompletionLog, today: string): number {
  let total = 0;
  for (let day = startOfWeek(today); day <= today; day = addDays(day, 1)) total += log[day] ?? 0;
  return total;
}

export function totalCompleted(log: CompletionLog): number {
  return Object.values(log).reduce((sum, n) => sum + n, 0);
}

/** Columnas de semanas (lunes a domingo) que terminan en la semana actual; los días futuros se omiten. */
export function heatmap(log: CompletionLog, today: string, weeks: number): HeatmapCell[][] {
  const start = addDays(startOfWeek(today), -7 * (weeks - 1));
  const max = Math.max(0, ...Object.values(log));
  const columns: HeatmapCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const column: HeatmapCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(start, w * 7 + d);
      if (date > today) break;
      const count = log[date] ?? 0;
      const level = count && max ? (Math.ceil((count / max) * 4) as HeatmapCell['level']) : 0;
      column.push({ date, count, level });
    }
    columns.push(column);
  }
  return columns;
}

/** Total por día de la semana, empezando el lunes. */
export function byWeekday(log: CompletionLog): number[] {
  const totals = [0, 0, 0, 0, 0, 0, 0];
  for (const [day, count] of Object.entries(log)) {
    totals[(fromIsoDate(day).getDay() + 6) % 7] += count;
  }
  return totals;
}

export function topTags(tasks: Task[], limit = 5): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const task of tasks) {
    if (!task.done) continue;
    for (const tag of task.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, limit);
}
