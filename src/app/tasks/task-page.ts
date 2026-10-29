import {
  CdkDrag,
  CdkDragDrop,
  CdkDragPlaceholder,
  CdkDropList,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  input,
  untracked,
} from '@angular/core';
import { AppEvents } from '../core/app-events';
import { Clock } from '../core/clock';
import {
  capitalize,
  formatDayMonth,
  formatLongDate,
  formatRelativeDay,
  localDay,
} from '../core/dates';
import { Task } from '../core/task';
import { TaskStore } from '../core/task-store';
import { Toast } from '../core/toast';
import { VIEWS, ViewId } from '../core/views';
import { I18n } from '../i18n/i18n';
import { Icon, IconName } from '../ui/icon';
import { QuickAdd, QuickAddDefaults } from './quick-add';
import { TaskItem } from './task-item';

interface Section {
  id: string;
  label?: string;
  sublabel?: string;
  tone?: 'danger';
  tasks: Task[];
  /** Solo se puede reordenar donde el orden es manual (no por fecha). */
  sortable: boolean;
  /** Se ocultan cuando el encabezado ya indica la fecha. */
  showDates: boolean;
}

const EMPTY_ICONS: Record<ViewId | 'tag', IconName> = {
  hoy: 'sun',
  proximas: 'calendar',
  todas: 'inbox',
  completadas: 'circle-check',
  tag: 'hash',
};

@Component({
  selector: 'app-task-page',
  imports: [CdkDropList, CdkDrag, CdkDragPlaceholder, Icon, QuickAdd, TaskItem],
  templateUrl: './task-page.html',
  styleUrl: './task-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskPage {
  private readonly store = inject(TaskStore);
  private readonly clock = inject(Clock);
  private readonly toast = inject(Toast);
  private readonly events = inject(AppEvents);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly i18n = inject(I18n);
  protected readonly t = this.i18n.t;

  /** Vienen de la ruta (`data.view` y el parámetro `:tag`). */
  readonly view = input<ViewId>();
  readonly tag = input<string>();

  protected readonly meta = computed(() => {
    const tag = this.tag();
    if (tag) return { label: `#${tag}`, icon: 'hash' as IconName };
    const view = VIEWS.find((v) => v.id === this.view())!;
    return { label: this.t(`view.${view.id}`), icon: view.icon };
  });

  protected readonly subtitle = computed(() => {
    if (this.view() === 'hoy') {
      return capitalize(formatLongDate(this.clock.today(), this.i18n.lang()));
    }
    const count = this.sections().reduce((sum, s) => sum + s.tasks.length, 0);
    return this.i18n.plural('page.tasks', count);
  });

  protected readonly quickAddDefaults = computed<QuickAddDefaults>(() => {
    const tag = this.tag();
    if (tag) return { tags: [tag] };
    return this.view() === 'hoy' ? { due: this.clock.today() } : {};
  });

  protected readonly progress = computed(() => {
    const done = this.store.completedToday();
    const total = done + this.store.overdue().length + this.store.dueToday().length;
    return { done, total, ratio: total ? done / total : 0 };
  });

  protected readonly sections = computed<Section[]>(() => {
    const today = this.clock.today();
    const lang = this.i18n.lang();
    const tag = this.tag();
    if (tag) {
      return [
        { id: 'tag', tasks: this.store.pendingWithTag(tag), sortable: true, showDates: true },
      ];
    }

    switch (this.view()) {
      case 'hoy': {
        const overdue = this.store.overdue();
        const sections: Section[] = [];
        if (overdue.length) {
          sections.push({
            id: 'overdue',
            label: this.t('page.overdue'),
            tone: 'danger',
            tasks: overdue,
            sortable: true,
            showDates: true,
          });
        }
        sections.push({
          id: 'today',
          label: overdue.length ? this.t('page.today') : undefined,
          tasks: this.store.dueToday(),
          sortable: true,
          showDates: false,
        });
        return sections;
      }
      case 'proximas':
        return groupBy(this.store.upcoming(), (t) => t.due!).map(([due, tasks]) => ({
          id: due,
          label: formatRelativeDay(due, today, lang),
          sublabel: formatDayMonth(due, lang),
          tasks,
          sortable: false,
          showDates: false,
        }));
      case 'completadas':
        return groupBy(this.store.completed(), (t) => localDay(t.completedAt!)).map(
          ([day, tasks]) => ({
            id: day,
            label: formatRelativeDay(day, today, lang),
            tasks,
            sortable: false,
            showDates: true,
          }),
        );
      default:
        return [{ id: 'all', tasks: this.store.pending(), sortable: true, showDates: true }];
    }
  });

  protected readonly isEmpty = computed(() => this.sections().every((s) => !s.tasks.length));
  protected readonly emptyState = computed(() => {
    const key = this.tag() ? 'tag' : this.view()!;
    return {
      icon: EMPTY_ICONS[key],
      title: this.t(`empty.${key}.title`),
      text: this.t(`empty.${key}.text`),
    };
  });

  constructor() {
    // Enfoca la tarea elegida en la paleta de comandos una vez que la vista está en pantalla.
    afterRenderEffect(() => {
      const id = this.events.taskToFocus();
      if (!id) return;
      const row = this.host.nativeElement.querySelector<HTMLElement>(`[data-task-id="${id}"]`);
      if (!row) return;
      row.focus();
      row.scrollIntoView({ block: 'center', behavior: 'smooth' });
      untracked(() => this.events.taskToFocus.set(null));
    });
  }

  protected drop(section: Section, event: CdkDragDrop<Task[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const ids = section.tasks.map((t) => t.id);
    moveItemInArray(ids, event.previousIndex, event.currentIndex);
    this.store.reorder(ids);
  }

  protected clearCompleted(): void {
    const { count, undo } = this.store.clearCompleted();
    if (count) {
      this.toast.show(this.i18n.plural('page.cleared', count), {
        actionLabel: this.t('task.undo'),
        action: undo,
      });
    }
  }
}

function groupBy<T>(items: T[], key: (item: T) => string): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    groups.set(k, [...(groups.get(k) ?? []), item]);
  }
  return [...groups];
}
