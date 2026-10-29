import { CdkTrapFocus } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  untracked,
  viewChild,
} from '@angular/core';
import { Clock } from '../core/clock';
import { fromIsoDate } from '../core/dates';
import { parseQuickAdd } from '../core/quick-add-parser';
import { Repeat, RepeatUnit } from '../core/recurrence';
import { Priority } from '../core/task';
import { TaskDetailState } from '../core/task-detail-state';
import { TaskStore } from '../core/task-store';
import { Toast } from '../core/toast';
import { I18n } from '../i18n/i18n';
import { Icon } from '../ui/icon';

const PRIORITIES: Priority[] = [3, 2, 1, 0];
const REPEAT_UNITS: RepeatUnit[] = ['day', 'weekday', 'week', 'month', 'year'];

@Component({
  selector: 'app-task-detail',
  imports: [Icon, CdkTrapFocus],
  templateUrl: './task-detail.html',
  styleUrl: './task-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(keydown.escape)': 'close()' },
})
export class TaskDetail {
  private readonly store = inject(TaskStore);
  private readonly state = inject(TaskDetailState);
  private readonly clock = inject(Clock);
  private readonly toast = inject(Toast);
  private readonly injector = inject(Injector);
  protected readonly i18n = inject(I18n);
  protected readonly t = this.i18n.t;

  protected readonly priorities = computed(() =>
    PRIORITIES.map((level) => ({ level, label: this.t(`priority.${level}`) })),
  );
  protected readonly repeatUnits = REPEAT_UNITS;

  protected readonly task = computed(() => {
    const id = this.state.openId();
    return id ? (this.store.get(id) ?? null) : null;
  });

  protected readonly subtasksDone = computed(
    () => this.task()?.subtasks.filter((s) => s.done).length ?? 0,
  );

  protected readonly repeatValue = computed(() => {
    const repeat = this.task()?.repeat;
    if (!repeat) return 'none';
    return repeat.every > 1 ? 'custom' : repeat.unit;
  });

  protected readonly createdLabel = computed(() => {
    const task = this.task();
    return task
      ? this.t('detail.created', {
          date: fromIsoDate(task.createdAt.slice(0, 10)).toLocaleDateString(
            this.i18n.lang() === 'es' ? 'es-AR' : 'en-US',
            { day: 'numeric', month: 'long', year: 'numeric' },
          ),
        })
      : '';
  });

  private readonly titleInput = viewChild<ElementRef<HTMLTextAreaElement>>('titleInput');
  private lastFocused: HTMLElement | null = null;

  constructor() {
    // Al abrir: guarda dónde estaba el foco y lo lleva al título. Al cerrar: lo devuelve.
    effect(() => {
      const id = this.state.openId();
      untracked(() => {
        if (id) {
          this.lastFocused ??= document.activeElement as HTMLElement | null;
          afterNextRender(() => this.titleInput()?.nativeElement.focus(), {
            injector: this.injector,
          });
        } else if (this.lastFocused) {
          const row = this.lastFocused;
          this.lastFocused = null;
          if (row.isConnected) row.focus();
        }
      });
    });
    // Si la tarea abierta se elimina, se cierra el panel.
    effect(() => {
      if (this.state.openId() && !this.task()) untracked(() => this.state.close());
    });
  }

  close(): void {
    this.state.close();
  }

  protected toggle(): void {
    const task = this.task()!;
    const undo = this.store.toggle(task.id);
    if (!task.done) {
      this.toast.show(this.t('task.completed'), { actionLabel: this.t('task.undo'), action: undo });
      if (!task.repeat) this.close();
    }
  }

  protected saveTitle(value: string): void {
    const task = this.task();
    if (!task) return;
    const parsed = parseQuickAdd(value, this.clock.today(), this.i18n.lang());
    if (!parsed.title || value.trim() === task.title) return;
    this.store.update(task.id, {
      title: parsed.title,
      due: parsed.due ?? task.due,
      time: parsed.time ?? task.time,
      priority: parsed.priority || task.priority,
      repeat: parsed.repeat ?? task.repeat,
      tags: [...new Set([...task.tags, ...parsed.tags])],
    });
  }

  protected setDue(value: string): void {
    const task = this.task()!;
    // Sin fecha no hay repetición ni hora que tenga sentido.
    this.store.update(task.id, value ? { due: value } : { due: null, time: null, repeat: null });
  }

  protected setTime(value: string): void {
    const task = this.task()!;
    this.store.update(task.id, { time: value || null, due: task.due ?? this.clock.today() });
  }

  protected setPriority(priority: Priority): void {
    this.store.update(this.task()!.id, { priority });
  }

  protected setRepeat(value: string): void {
    const task = this.task()!;
    if (value === 'custom') return;
    if (value === 'none') {
      this.store.update(task.id, { repeat: null });
      return;
    }
    const due = task.due ?? this.clock.today();
    const repeat: Repeat = { unit: value as RepeatUnit, every: 1 };
    if (repeat.unit === 'month') repeat.day = fromIsoDate(due).getDate();
    this.store.update(task.id, { repeat, due });
  }

  protected addTag(input: HTMLInputElement): void {
    const tag = input.value.trim().replace(/^#/, '').toLowerCase().replace(/\s+/g, '-');
    const task = this.task()!;
    if (tag && !task.tags.includes(tag)) this.store.update(task.id, { tags: [...task.tags, tag] });
    input.value = '';
  }

  protected removeTag(tag: string): void {
    const task = this.task()!;
    this.store.update(task.id, { tags: task.tags.filter((t) => t !== tag) });
  }

  protected setNotes(value: string): void {
    this.store.update(this.task()!.id, { notes: value });
  }

  protected addSubtask(input: HTMLInputElement): void {
    this.store.addSubtask(this.task()!.id, input.value);
    input.value = '';
  }

  protected toggleSubtask(id: string, done: boolean): void {
    this.store.updateSubtask(this.task()!.id, id, { done });
  }

  protected renameSubtask(id: string, title: string): void {
    if (title.trim()) this.store.updateSubtask(this.task()!.id, id, { title: title.trim() });
  }

  protected removeSubtask(id: string): void {
    this.store.removeSubtask(this.task()!.id, id);
  }

  protected remove(): void {
    const undo = this.store.remove(this.task()!.id);
    this.close();
    this.toast.show(this.t('task.deleted'), { actionLabel: this.t('task.undo'), action: undo });
  }

  /** Ajusta el alto de un textarea a su contenido. */
  protected autosize(textarea: HTMLTextAreaElement): void {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  /** Enter en el título guarda en vez de agregar un salto de línea. */
  protected onTitleKeydown(event: KeyboardEvent, textarea: HTMLTextAreaElement): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      textarea.blur();
    }
  }
}
