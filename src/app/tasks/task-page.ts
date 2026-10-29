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
import { capitalize, formatDayMonth, formatLongDate, formatRelativeDay } from '../core/dates';
import { Task } from '../core/task';
import { TaskStore } from '../core/task-store';
import { Toast } from '../core/toast';
import { VIEWS, ViewId } from '../core/views';
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

interface EmptyState {
  icon: IconName;
  title: string;
  text: string;
}

const EMPTY_STATES: Record<ViewId | 'tag', EmptyState> = {
  hoy: {
    icon: 'sun',
    title: 'Nada pendiente para hoy',
    text: 'Disfrutá el día o adelantá algo de Próximas.',
  },
  proximas: {
    icon: 'calendar',
    title: 'Sin tareas programadas',
    text: 'Agregá una fecha: "el viernes", "15/11", "en 3 días".',
  },
  todas: {
    icon: 'inbox',
    title: 'Bandeja vacía',
    text: 'Todo lo que agregues sin fecha aparece acá.',
  },
  completadas: {
    icon: 'circle-check',
    title: 'Todavía no completaste tareas',
    text: 'Las tareas que termines van a aparecer acá.',
  },
  tag: {
    icon: 'hash',
    title: 'Sin tareas pendientes',
    text: 'No queda nada pendiente con esta etiqueta.',
  },
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

  /** Vienen de la ruta (`data.view` y el parámetro `:tag`). */
  readonly view = input<ViewId>();
  readonly tag = input<string>();

  protected readonly meta = computed(() => {
    const tag = this.tag();
    if (tag) return { label: `#${tag}`, icon: 'hash' as IconName };
    return VIEWS.find((v) => v.id === this.view())!;
  });

  protected readonly subtitle = computed(() => {
    if (this.view() === 'hoy') return capitalize(formatLongDate(this.clock.today()));
    const count = this.sections().reduce((sum, s) => sum + s.tasks.length, 0);
    return count === 1 ? '1 tarea' : `${count} tareas`;
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
    const tag = this.tag();
    if (tag)
      return [
        { id: 'tag', tasks: this.store.pendingWithTag(tag), sortable: true, showDates: true },
      ];

    switch (this.view()) {
      case 'hoy': {
        const overdue = this.store.overdue();
        const sections: Section[] = [];
        if (overdue.length)
          sections.push({
            id: 'overdue',
            label: 'Vencidas',
            tone: 'danger',
            tasks: overdue,
            sortable: true,
            showDates: true,
          });
        sections.push({
          id: 'today',
          label: overdue.length ? 'Hoy' : undefined,
          tasks: this.store.dueToday(),
          sortable: true,
          showDates: false,
        });
        return sections;
      }
      case 'proximas':
        return groupBy(this.store.upcoming(), (t) => t.due!).map(([due, tasks]) => ({
          id: due,
          label: formatRelativeDay(due, today),
          sublabel: formatDayMonth(due),
          tasks,
          sortable: false,
          showDates: false,
        }));
      case 'completadas':
        return groupBy(this.store.completed(), (t) => t.completedAt!.slice(0, 10)).map(
          ([day, tasks]) => ({
            id: day,
            label: formatRelativeDay(day, today),
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
  protected readonly emptyState = computed(() => EMPTY_STATES[this.tag() ? 'tag' : this.view()!]);

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
    const removed = this.store.clearCompleted();
    if (removed.length) {
      this.toast.undoable(
        removed.length === 1 ? 'Se borró 1 tarea' : `Se borraron ${removed.length} tareas`,
        () => this.store.restore(...removed),
      );
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
