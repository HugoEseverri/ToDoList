import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { Overlay } from '@angular/cdk/overlay';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { AppEvents } from '../core/app-events';
import { Clock } from '../core/clock';
import { DataTransfer } from '../core/data-transfer';
import { formatRelativeDay } from '../core/dates';
import { Reminders } from '../core/reminders';
import { TaskStore } from '../core/task-store';
import { Theme } from '../core/theme';
import { Toast } from '../core/toast';
import { STATS_SHORTCUT, VIEWS, viewForTask } from '../core/views';
import { I18n } from '../i18n/i18n';
import { MessageKey } from '../i18n/messages';
import { Icon, IconName } from '../ui/icon';
import { Dialogs } from './dialogs';

interface PaletteItem {
  id: string;
  group: string;
  label: string;
  icon: IconName;
  hint?: string;
  keywords?: string;
  run: () => void;
}

const MAX_TASK_RESULTS = 8;

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

export function openCommandPalette(injector: Injector): DialogRef<unknown, CommandPalette> {
  return injector.get(Dialog).open(CommandPalette, {
    ariaLabel: injector.get(I18n).t('palette.label'),
    panelClass: 'app-dialog-panel',
    backdropClass: 'cdk-overlay-dark-backdrop',
    positionStrategy: injector.get(Overlay).position().global().centerHorizontally().top('12vh'),
    restoreFocus: true,
  });
}

@Component({
  selector: 'app-command-palette',
  imports: [Icon],
  templateUrl: './command-palette.html',
  styleUrl: './command-palette.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommandPalette {
  private readonly dialogRef = inject(DialogRef);
  private readonly router = inject(Router);
  private readonly store = inject(TaskStore);
  private readonly theme = inject(Theme);
  private readonly toast = inject(Toast);
  private readonly clock = inject(Clock);
  private readonly events = inject(AppEvents);
  private readonly dialogs = inject(Dialogs);
  private readonly data = inject(DataTransfer);
  private readonly reminders = inject(Reminders);
  protected readonly i18n = inject(I18n);
  protected readonly t = this.i18n.t;

  protected readonly query = signal('');
  protected readonly activeIndex = signal(0);
  private readonly list = viewChild.required<ElementRef<HTMLElement>>('list');

  private readonly commands = computed<PaletteItem[]>(() => {
    const t = this.t;
    const item = (
      id: string,
      group: MessageKey,
      label: MessageKey,
      icon: IconName,
      run: () => void,
      extra: { hint?: string; keywords?: MessageKey } = {},
    ): PaletteItem => ({
      id,
      group: t(group),
      label: t(label),
      icon,
      run,
      hint: extra.hint,
      keywords: extra.keywords && t(extra.keywords),
    });
    const prefs = 'palette.group.preferences';
    const data = 'palette.group.data';

    return [
      item(
        'new-task',
        'palette.group.actions',
        'palette.newTask',
        'plus',
        () => setTimeout(() => this.events.focusQuickAdd$.next()),
        { hint: 'N', keywords: 'palette.newTask.keywords' },
      ),
      ...VIEWS.map((view) =>
        item(
          `view-${view.id}`,
          'palette.group.goto',
          `view.${view.id}`,
          view.icon,
          () => this.router.navigate(['/', view.id]),
          { hint: view.shortcut },
        ),
      ),
      item(
        'view-stats',
        'palette.group.goto',
        'view.estadisticas',
        'chart',
        () => this.router.navigate(['/estadisticas']),
        { hint: STATS_SHORTCUT },
      ),
      ...this.store.tags().map<PaletteItem>((tag) => ({
        id: `tag-${tag.name}`,
        group: t('palette.group.tags'),
        label: `#${tag.name}`,
        icon: 'hash',
        run: () => this.router.navigate(['/etiqueta', tag.name]),
      })),
      item('theme-light', prefs, 'palette.themeLight', 'sun', () => this.theme.mode.set('light'), {
        keywords: 'palette.theme.keywords',
      }),
      item('theme-dark', prefs, 'palette.themeDark', 'moon', () => this.theme.mode.set('dark'), {
        keywords: 'palette.theme.keywords',
      }),
      item(
        'theme-system',
        prefs,
        'palette.themeSystem',
        'monitor',
        () => this.theme.mode.set('system'),
        { keywords: 'palette.theme.keywords' },
      ),
      item('language', prefs, 'palette.language', 'languages', () => this.i18n.toggle(), {
        hint: 'L',
        keywords: 'palette.language.keywords',
      }),
      item(
        'reminders',
        prefs,
        this.reminders.enabled() ? 'palette.reminders.off' : 'palette.reminders.on',
        'bell',
        () => void this.reminders.toggle(),
        { keywords: 'palette.reminders.keywords' },
      ),
      item(
        'shortcuts',
        prefs,
        'palette.shortcuts',
        'keyboard',
        () => this.dialogs.openShortcuts(),
        {
          hint: '?',
          keywords: 'palette.shortcuts.keywords',
        },
      ),
      item('export', data, 'palette.export', 'download', () => this.data.export(), {
        keywords: 'palette.export.keywords',
      }),
      item('import', data, 'palette.import', 'upload', () => this.data.pickFile(), {
        keywords: 'palette.import.keywords',
      }),
      item('examples', data, 'palette.examples', 'sparkles', () => this.data.addExamples(), {
        keywords: 'palette.examples.keywords',
      }),
      item(
        'clear-completed',
        data,
        'palette.clearCompleted',
        'trash',
        () => {
          const { count, undo } = this.store.clearCompleted();
          if (!count) {
            this.toast.show(t('page.noCompleted'));
            return;
          }
          this.toast.show(this.i18n.plural('page.cleared', count), {
            actionLabel: t('task.undo'),
            action: undo,
          });
        },
        { keywords: 'palette.clearCompleted.keywords' },
      ),
    ];
  });

  protected readonly items = computed<PaletteItem[]>(() => {
    const query = normalize(this.query().trim());
    if (!query) return this.commands();

    const matches = (text: string) => normalize(text).includes(query);
    const commands = this.commands()
      .filter((c) => matches(c.label) || matches(c.keywords ?? ''))
      .sort(
        (a, b) =>
          Number(normalize(b.label).startsWith(query)) -
          Number(normalize(a.label).startsWith(query)),
      );

    const today = this.clock.today();
    const tasks = this.store
      .tasks()
      .filter((t) => matches(t.title) || t.tags.some((tag) => matches(tag)))
      .sort((a, b) => Number(a.done) - Number(b.done))
      .slice(0, MAX_TASK_RESULTS)
      .map<PaletteItem>((task) => ({
        id: `task-${task.id}`,
        group: this.t('palette.group.tasks'),
        label: task.title,
        icon: task.done ? 'circle-check' : 'arrow-right',
        hint: task.done
          ? this.t('palette.completed')
          : task.due
            ? formatRelativeDay(task.due, today, this.i18n.lang())
            : undefined,
        run: () => {
          this.events.taskToFocus.set(task.id);
          this.router.navigate(['/', viewForTask(task, today)]);
        },
      }));

    return [...tasks, ...commands];
  });

  constructor() {
    // Al cambiar la búsqueda, el primer resultado vuelve a ser el activo.
    effect(() => {
      this.items();
      this.activeIndex.set(0);
    });
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.items().length;
    if (!count) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      this.activeIndex.update((i) => (i + step + count) % count);
      this.scrollActiveIntoView();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.run(this.items()[this.activeIndex()]);
    }
  }

  protected run(item: PaletteItem | undefined): void {
    if (!item) return;
    this.dialogRef.close();
    item.run();
  }

  private scrollActiveIntoView(): void {
    queueMicrotask(() =>
      this.list()
        .nativeElement.querySelector('[aria-selected="true"]')
        ?.scrollIntoView({ block: 'nearest' }),
    );
  }
}
