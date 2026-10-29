import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { AppEvents } from '../core/app-events';
import { Clock } from '../core/clock';
import { formatRelativeDay } from '../core/dates';
import { ParsedTask, parseQuickAdd } from '../core/quick-add-parser';
import { PRIORITY_LABELS } from '../core/task';
import { TaskStore } from '../core/task-store';
import { Toast } from '../core/toast';
import { ViewId, VIEWS, viewForTask } from '../core/views';
import { Icon } from '../ui/icon';

export interface QuickAddDefaults {
  due?: string;
  tags?: string[];
}

@Component({
  selector: 'app-quick-add',
  imports: [Icon],
  templateUrl: './quick-add.html',
  styleUrl: './quick-add.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuickAdd {
  private readonly store = inject(TaskStore);
  private readonly clock = inject(Clock);
  private readonly toast = inject(Toast);
  private readonly router = inject(Router);

  /** Valores que se aplican si el texto no los indica (ej.: en "Hoy" la fecha es hoy). */
  readonly defaults = input<QuickAddDefaults>({});
  /** Vista actual, para avisar si la tarea nueva queda en otra. */
  readonly currentView = input<ViewId | null>(null);

  protected readonly text = signal('');
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');

  protected readonly parsed = computed(() =>
    this.withDefaults(parseQuickAdd(this.text(), this.clock.today())),
  );
  protected readonly chips = computed(() => {
    if (!this.text().trim()) return [];
    const { due, time, tags, priority } = this.parsed();
    const chips: { label: string; kind: string }[] = [];
    if (due) chips.push({ label: formatRelativeDay(due, this.clock.today()), kind: 'due' });
    if (time) chips.push({ label: time, kind: 'time' });
    for (const tag of tags) chips.push({ label: `#${tag}`, kind: 'tag' });
    if (priority) chips.push({ label: PRIORITY_LABELS[priority], kind: `priority-${priority}` });
    return chips;
  });

  constructor() {
    inject(AppEvents)
      .focusQuickAdd$.pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.input().nativeElement.focus());
  }

  protected submit(): void {
    if (!this.text().trim()) return;
    const task = this.store.add(this.parsed());
    this.text.set('');

    const target = viewForTask(task, this.clock.today());
    const current = this.currentView();
    if (current && current !== target && !this.defaults().tags?.length) {
      const label = VIEWS.find((v) => v.id === target)!.label;
      this.toast.show(`Agregada a ${label}`, {
        actionLabel: 'Ver',
        action: () => this.router.navigate(['/', target]),
      });
    }
  }

  protected onEscape(): void {
    if (this.text()) this.text.set('');
    else this.input().nativeElement.blur();
  }

  private withDefaults(parsed: ParsedTask): ParsedTask {
    const defaults = this.defaults();
    return {
      ...parsed,
      due: parsed.due ?? defaults.due ?? null,
      tags: [...new Set([...parsed.tags, ...(defaults.tags ?? [])])],
    };
  }
}
