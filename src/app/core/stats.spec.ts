import { normalizeTask } from './task';
import {
  bestStreak,
  byWeekday,
  completedThisWeek,
  currentStreak,
  heatmap,
  startOfWeek,
  topTags,
  totalCompleted,
} from './stats';

// Jueves 29 de octubre de 2026.
const TODAY = '2026-10-29';

describe('estadísticas', () => {
  it('la semana empieza el lunes', () => {
    expect(startOfWeek(TODAY)).toBe('2026-10-26');
    expect(startOfWeek('2026-11-01')).toBe('2026-10-26');
  });

  describe('racha actual', () => {
    it('cuenta días seguidos hasta hoy', () => {
      expect(currentStreak({ '2026-10-27': 1, '2026-10-28': 2, [TODAY]: 1 }, TODAY)).toBe(3);
    });

    it('sigue viva si hoy todavía no se completó nada', () => {
      expect(currentStreak({ '2026-10-27': 1, '2026-10-28': 2 }, TODAY)).toBe(2);
    });

    it('se corta con un día sin actividad', () => {
      expect(currentStreak({ '2026-10-26': 1, '2026-10-28': 1 }, TODAY)).toBe(1);
      expect(currentStreak({ '2026-10-20': 1 }, TODAY)).toBe(0);
    });
  });

  it('mejor racha histórica', () => {
    expect(
      bestStreak({
        '2026-09-01': 1,
        '2026-09-02': 1,
        '2026-09-03': 4,
        '2026-10-01': 1,
        '2026-10-02': 1,
      }),
    ).toBe(3);
    expect(bestStreak({})).toBe(0);
  });

  it('total de la semana y total general', () => {
    const log = { '2026-10-25': 5, '2026-10-26': 1, [TODAY]: 2 };
    expect(completedThisWeek(log, TODAY)).toBe(3);
    expect(totalCompleted(log)).toBe(8);
  });

  it('el mapa de calor arma columnas de lunes a domingo sin días futuros', () => {
    const columns = heatmap({ [TODAY]: 4, '2026-10-27': 1 }, TODAY, 3);
    expect(columns).toHaveLength(3);
    expect(columns[0][0].date).toBe('2026-10-12');
    expect(columns[2].map((c) => c.date)).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      TODAY,
    ]);
    expect(columns[2].map((c) => c.level)).toEqual([0, 1, 0, 4]);
  });

  it('agrupa por día de la semana empezando el lunes', () => {
    expect(byWeekday({ '2026-10-26': 2, '2026-11-02': 1, '2026-11-01': 5 })).toEqual([
      3, 0, 0, 0, 0, 0, 5,
    ]);
  });

  it('etiquetas más completadas', () => {
    const tasks = [
      { title: 'a', done: true, tags: ['casa', 'auto'] },
      { title: 'b', done: true, tags: ['casa'] },
      { title: 'c', done: false, tags: ['auto', 'auto2'] },
    ].map((t) => normalizeTask(t)!);
    expect(topTags(tasks)).toEqual([
      { tag: 'casa', count: 2 },
      { tag: 'auto', count: 1 },
    ]);
  });
});
