import { MessageKey } from '../i18n/messages';
import { addDays, fromIsoDate } from './dates';
import { Task } from './task';

type Translate = (key: MessageKey) => string;

/** Tareas de ejemplo para la primera visita: enseñan a usar la app usándola. */
export function createWelcomeTasks(today: string, t: Translate): Task[] {
  const now = new Date().toISOString();
  const welcome = t('welcome.tag.welcome');
  const base: Omit<Task, 'id' | 'title' | 'order'> = {
    done: false,
    priority: 0,
    due: null,
    time: null,
    tags: [],
    repeat: null,
    notes: '',
    subtasks: [],
    createdAt: now,
    completedAt: null,
  };
  const seeds: (Partial<Task> & { title: string })[] = [
    { title: t('welcome.1'), due: today, priority: 3, tags: [welcome] },
    { title: t('welcome.2'), due: today, tags: [welcome] },
    { title: t('welcome.3'), due: today, tags: [welcome] },
    {
      title: t('welcome.4'),
      due: today,
      tags: [welcome],
      notes: t('welcome.notes'),
      subtasks: [
        { id: crypto.randomUUID(), title: t('welcome.subtask.1'), done: true },
        { id: crypto.randomUUID(), title: t('welcome.subtask.2'), done: false },
      ],
    },
    { title: t('welcome.5'), due: today, tags: [welcome] },
    {
      title: t('welcome.6'),
      due: addDays(today, 1),
      repeat: { unit: 'week', every: 1 },
      tags: [t('welcome.tag.home')],
    },
    {
      title: t('welcome.7'),
      due: nextFriday(today),
      time: '09:00',
      priority: 2,
      tags: [t('welcome.tag.personal')],
    },
    { title: t('welcome.8'), tags: [welcome] },
  ];
  return seeds.map((seed, order) => ({ ...base, ...seed, id: crypto.randomUUID(), order }));
}

function nextFriday(today: string): string {
  const diff = (5 - fromIsoDate(today).getDay() + 7) % 7 || 7;
  return addDays(today, diff);
}
