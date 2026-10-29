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
import { PRIORITY_LABELS, Priority, Task } from '../core/task';
import { TaskStore } from '../core/task-store';
import { Toast } from '../core/toast';
import { Icon } from '../ui/icon';

/** Ciclo al tocar la bandera: sin prioridad → alta → media → baja → sin prioridad. */
const NEXT_PRIORITY: Record<Priority, Priority> = { 0: 3, 3: 2, 2: 1, 1: 0 };
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
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly task = input.required<Task>();
  /** En "Próximas" la fecha ya está en el encabezado del grupo. */
  readonly showDate = input(true);

  protected readonly editing = signal(false);
  /** Estado visual inmediato al completar, antes de que la tarea salga de la lista. */
  protected readonly completing = signal(false);
  protected readonly checked = computed(() => this.task().done || this.completing());

  protected readonly editInput = viewChild<ElementRef<HTMLInputElement>>('editInput');
  protected readonly dateInput = viewChild<ElementRef<HTMLInputElement>>('dateInput');

  protected readonly dueLabel = computed(() => {
    const due = this.task().due;
    return due ? formatRelativeDay(due, this.clock.today()) : null;
  });
  protected readonly dueState = computed(() => {
    const due = this.task().due;
    if (!due || this.task().done) return 'normal';
    const today = this.clock.today();
    return due < today ? 'overdue' : due === today ? 'today' : 'normal';
  });
  protected readonly priorityLabel = computed(() => PRIORITY_LABELS[this.task().priority]);

  complete(): void {
    const task = this.task();
    if (task.done) {
      this.store.toggle(task.id);
      return;
    }
    if (this.completing()) return;
    this.completing.set(true);
    setTimeout(() => {
      this.store.toggle(task.id);
      this.toast.undoable('Tarea completada', () => this.store.toggle(task.id));
    }, COMPLETE_DELAY_MS);
  }

  remove(): void {
    this.focusSibling(1) || this.focusSibling(-1);
    const removed = this.store.remove(this.task().id);
    if (removed) this.toast.undoable('Tarea eliminada', () => this.store.restore(removed));
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

  protected setDate(value: string): void {
    this.store.update(this.task().id, {
      due: value || null,
      time: value ? this.task().time : null,
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
    const parsed = parseQuickAdd(value, this.clock.today());
    const task = this.task();
    if (!parsed.title) return;
    this.store.update(task.id, {
      title: parsed.title,
      due: parsed.due ?? task.due,
      time: parsed.time ?? task.time,
      priority: parsed.priority || task.priority,
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

  protected onKeydown(event: KeyboardEvent): void {
    if (this.editing() || event.target !== event.currentTarget) return;
    const actions: Record<string, () => unknown> = {
      ArrowDown: () => this.focusSibling(1),
      ArrowUp: () => this.focusSibling(-1),
      ' ': () => this.complete(),
      Enter: () => this.startEdit(),
      e: () => this.startEdit(),
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
