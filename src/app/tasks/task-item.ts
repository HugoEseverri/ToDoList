import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Clock } from '../core/clock';
import { formatRelativeDay } from '../core/dates';
import { parseQuickAdd } from '../core/quick-add-parser';
import { Priority, Task } from '../core/task';
import { TaskDetailState } from '../core/task-detail-state';
import { TaskStore } from '../core/task-store';
import { Toast } from '../core/toast';
import { I18n } from '../i18n/i18n';
import { Icon } from '../ui/icon';

/** Ciclo al tocar la bandera: sin prioridad → alta → media → baja → sin prioridad. */
export const NEXT_PRIORITY: Record<Priority, Priority> = { 0: 3, 3: 2, 2: 1, 1: 0 };
const COMPLETE_DELAY_MS = 380;

@Component({
  selector: 'app-task-item',
  imports: [Icon],
  templateUrl: './task-item.html',
  styleUrl: './task-item.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskItem {
  private readonly store = inject(TaskStore);
  private readonly toast = inject(Toast);
  private readonly clock = inject(Clock);
  private readonly detail = inject(TaskDetailState);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  protected readonly i18n = inject(I18n);
  protected readonly t = this.i18n.t;

  readonly task = input.required<Task>();
  /** Se oculta cuando el encabezado de la sección ya indica la fecha. */
  readonly showDate = input(true);

  protected readonly editing = signal(false);
  /** Estado visual inmediato al completar, antes de que la tarea salga de la lista. */
  protected readonly completing = signal(false);
  protected readonly checked = computed(() => this.task().done || this.completing());
  protected readonly isOpen = computed(() => this.detail.openId() === this.task().id);

  protected readonly editInput = viewChild<ElementRef<HTMLInputElement>>('editInput');
  protected readonly dateInput = viewChild<ElementRef<HTMLInputElement>>('dateInput');

  protected readonly dueLabel = computed(() => {
    const due = this.task().due;
    return due ? formatRelativeDay(due, this.clock.today(), this.i18n.lang()) : null;
  });
  protected readonly dueState = computed(() => {
    const due = this.task().due;
    if (!due || this.task().done) return 'normal';
    const today = this.clock.today();
    return due < today ? 'overdue' : due === today ? 'today' : 'normal';
  });
  protected readonly repeatLabel = computed(() => {
    const { repeat, due } = this.task();
    return repeat ? this.i18n.repeatLabel(repeat, due) : null;
  });
  protected readonly subtaskProgress = computed(() => {
    const subtasks = this.task().subtasks;
    return subtasks.length
      ? { done: subtasks.filter((s) => s.done).length, total: subtasks.length }
      : null;
  });
  protected readonly priorityLabel = computed(() => this.t(`priority.${this.task().priority}`));

  complete(): void {
    const task = this.task();
    if (task.done) {
      this.store.toggle(task.id);
      return;
    }
    if (this.completing()) return;
    this.completing.set(true);
    setTimeout(() => {
      const undo = this.store.toggle(task.id);
      const next = this.store.get(task.id);
      // Las tareas repetitivas siguen en la lista con su próxima fecha.
      this.completing.set(false);
      const message =
        task.repeat && next?.due
          ? this.t('task.completedRepeat', {
              date: formatRelativeDay(next.due, this.clock.today(), this.i18n.lang()),
            })
          : this.t('task.completed');
      this.toast.show(message, { actionLabel: this.t('task.undo'), action: undo });
    }, COMPLETE_DELAY_MS);
  }

  remove(): void {
    if (!this.focusSibling(1)) this.focusSibling(-1);
    if (this.isOpen()) this.detail.close();
    const undo = this.store.remove(this.task().id);
    this.toast.show(this.t('task.deleted'), { actionLabel: this.t('task.undo'), action: undo });
  }

  cyclePriority(): void {
    this.store.update(this.task().id, { priority: NEXT_PRIORITY[this.task().priority] });
  }

  openDatePicker(): void {
    const input = this.dateInput()?.nativeElement;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      input.focus();
    }
  }

  openDetail(): void {
    this.detail.open(this.task().id);
  }

  protected setDate(value: string): void {
    this.store.update(this.task().id, {
      due: value || null,
      time: value ? this.task().time : null,
      repeat: value ? this.task().repeat : null,
    });
  }

  startEdit(): void {
    if (this.task().done) return;
    this.editing.set(true);
    // Espera a que se pinte el input (en modo zoneless, un microtask llega antes del render).
    afterNextRender(
      () => {
        const input = this.editInput()?.nativeElement;
        input?.focus();
        input?.select();
      },
      { injector: this.injector },
    );
  }

  protected saveEdit(value: string): void {
    if (!this.editing()) return;
    this.editing.set(false);
    // El texto editado también acepta lenguaje natural: "... mañana #casa" agrega fecha y etiqueta.
    const parsed = parseQuickAdd(value, this.clock.today(), this.i18n.lang());
    const task = this.task();
    if (!parsed.title) return;
    this.store.update(task.id, {
      title: parsed.title,
      due: parsed.due ?? task.due,
      time: parsed.time ?? task.time,
      priority: parsed.priority || task.priority,
      repeat: parsed.repeat ?? task.repeat,
      tags: [...new Set([...task.tags, ...parsed.tags])],
    });
    this.focusRow();
  }

  protected cancelEdit(): void {
    this.editing.set(false);
    this.focusRow();
  }

  protected removeTag(tag: string): void {
    this.store.update(this.task().id, { tags: this.task().tags.filter((t) => t !== tag) });
  }

  protected onRowClick(event: MouseEvent): void {
    // Los clics en botones e inputs tienen su propia acción.
    if ((event.target as HTMLElement).closest('button, input')) return;
    if (!this.editing()) this.openDetail();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (this.editing() || event.target !== event.currentTarget) return;
    const actions: Record<string, () => unknown> = {
      ArrowDown: () => this.focusSibling(1),
      ArrowUp: () => this.focusSibling(-1),
      ' ': () => this.complete(),
      Enter: () => this.openDetail(),
      o: () => this.openDetail(),
      e: () => this.startEdit(),
      F2: () => this.startEdit(),
      Delete: () => this.remove(),
      Backspace: () => this.remove(),
      p: () => this.cyclePriority(),
      d: () => this.openDatePicker(),
    };
    const action = actions[event.key];
    if (action && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      action();
    }
  }

  private focusRow(): void {
    afterNextRender(() => this.row()?.focus(), { injector: this.injector });
  }

  private row(): HTMLElement | null {
    return this.host.nativeElement.querySelector<HTMLElement>('[data-task-row]');
  }

  /** Mueve el foco a la tarea anterior/siguiente visible en la página. */
  private focusSibling(direction: 1 | -1): boolean {
    const rows = [...document.querySelectorAll<HTMLElement>('[data-task-row]')];
    const next = rows[rows.indexOf(this.row()!) + direction];
    next?.focus();
    return !!next;
  }
}
