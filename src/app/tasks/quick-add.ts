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
import { ParsedTask, TokenKind, parseQuickAdd } from '../core/quick-add-parser';
import { TaskStore } from '../core/task-store';
import { Toast } from '../core/toast';
import { ViewId, viewForTask } from '../core/views';
import { I18n } from '../i18n/i18n';
import { Icon } from '../ui/icon';

export interface QuickAddDefaults {
  due?: string;
  tags?: string[];
}

interface Segment {
  text: string;
  /** Clase del token (`date`, `tag`, `priority-3`...) o `null` para texto común. */
  kind: string | null;
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
  protected readonly i18n = inject(I18n);
  protected readonly t = this.i18n.t;

  /** Valores que se aplican si el texto no los indica (ej.: en "Hoy" la fecha es hoy). */
  readonly defaults = input<QuickAddDefaults>({});
  /** Vista actual, para avisar si la tarea nueva queda en otra. */
  readonly currentView = input<ViewId | null>(null);

  protected readonly text = signal('');
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');
  private readonly mirror = viewChild.required<ElementRef<HTMLElement>>('mirror');

  private readonly rawParsed = computed(() =>
    parseQuickAdd(this.text(), this.clock.today(), this.i18n.lang()),
  );
  protected readonly parsed = computed(() => this.withDefaults(this.rawParsed()));

  /** El texto partido en fragmentos para pintar cada token reconocido con su color. */
  protected readonly segments = computed<Segment[]>(() => {
    const text = this.text();
    const segments: Segment[] = [];
    const { tokens, priority } = this.rawParsed();
    const kindOf = (kind: TokenKind) => (kind === 'priority' ? `priority-${priority}` : kind);
    let cursor = 0;
    for (const token of tokens) {
      if (token.start > cursor)
        segments.push({ text: text.slice(cursor, token.start), kind: null });
      segments.push({ text: text.slice(token.start, token.end), kind: kindOf(token.kind) });
      cursor = token.end;
    }
    if (cursor < text.length) segments.push({ text: text.slice(cursor), kind: null });
    return segments;
  });

  protected readonly chips = computed(() => {
    if (!this.text().trim()) return [];
    const { due, time, tags, priority, repeat } = this.parsed();
    const lang = this.i18n.lang();
    const chips: { label: string; kind: string }[] = [];
    if (due) chips.push({ label: formatRelativeDay(due, this.clock.today(), lang), kind: 'date' });
    if (time) chips.push({ label: time, kind: 'time' });
    if (repeat) chips.push({ label: this.i18n.repeatLabel(repeat, due), kind: 'repeat' });
    for (const tag of tags) chips.push({ label: `#${tag}`, kind: 'tag' });
    if (priority)
      chips.push({ label: this.t(`priority.${priority}`), kind: `priority-${priority}` });
    return chips;
  });

  constructor() {
    inject(AppEvents)
      .focusQuickAdd$.pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.input().nativeElement.focus());
  }

  protected onInput(value: string): void {
    this.text.set(value);
    this.syncScroll();
  }

  /** Mantiene la capa de resaltado alineada cuando el texto es más largo que el input. */
  protected syncScroll(): void {
    this.mirror().nativeElement.scrollLeft = this.input().nativeElement.scrollLeft;
  }

  protected submit(): void {
    if (!this.text().trim()) return;
    // El store toma solo los campos de la tarea; los tokens del resaltado no se guardan.
    const task = this.store.add(this.parsed());
    this.clear();

    const target = viewForTask(task, this.clock.today());
    const current = this.currentView();
    if (current && current !== target && !this.defaults().tags?.length) {
      this.toast.show(this.t('quickAdd.addedTo', { view: this.t(`view.${target}`) }), {
        actionLabel: this.t('quickAdd.view'),
        action: () => this.router.navigate(['/', target]),
      });
    }
  }

  protected onEscape(): void {
    if (this.text()) this.clear();
    else this.input().nativeElement.blur();
  }

  /**
   * Vacía el campo también en el DOM: si Enter llega antes de que Angular repinte, el binding
   * `[value]` todavía vale `''` y no detectaría el cambio, dejando el texto viejo a la vista.
   */
  private clear(): void {
    this.text.set('');
    this.input().nativeElement.value = '';
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
