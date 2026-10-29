import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { Overlay } from '@angular/cdk/overlay';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injectable,
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
import { formatRelativeDay } from '../core/dates';
import { TaskStore } from '../core/task-store';
import { Theme } from '../core/theme';
import { Toast } from '../core/toast';
import { VIEWS, viewForTask } from '../core/views';
import { Icon, IconName } from '../ui/icon';
import { ShortcutsDialog } from './shortcuts-dialog';

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

@Injectable({ providedIn: 'root' })
export class CommandPalette {
  private readonly dialog = inject(Dialog);
  private readonly overlay = inject(Overlay);
  private ref: DialogRef<unknown, CommandPaletteDialog> | null = null;

  open(): void {
    if (this.ref) return;
    this.ref = this.dialog.open(CommandPaletteDialog, {
      ariaLabel: 'Paleta de comandos',
      panelClass: 'app-dialog-panel',
      backdropClass: 'cdk-overlay-dark-backdrop',
      positionStrategy: this.overlay.position().global().centerHorizontally().top('12vh'),
      restoreFocus: true,
    });
    this.ref.closed.subscribe(() => (this.ref = null));
  }

  toggle(): void {
    if (this.ref) this.ref.close();
    else this.open();
  }
}

@Component({
  selector: 'app-command-palette',
  imports: [Icon],
  templateUrl: './command-palette.html',
  styleUrl: './command-palette.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommandPaletteDialog {
  private readonly dialogRef = inject(DialogRef);
  private readonly router = inject(Router);
  private readonly store = inject(TaskStore);
  private readonly theme = inject(Theme);
  private readonly toast = inject(Toast);
  private readonly clock = inject(Clock);
  private readonly events = inject(AppEvents);
  private readonly injector = inject(Injector);

  protected readonly query = signal('');
  protected readonly activeIndex = signal(0);
  private readonly list = viewChild.required<ElementRef<HTMLElement>>('list');

  private readonly commands = computed<PaletteItem[]>(() => [
    {
      id: 'new-task',
      group: 'Acciones',
      label: 'Nueva tarea',
      icon: 'plus',
      hint: 'N',
      keywords: 'agregar crear',
      run: () => setTimeout(() => this.events.focusQuickAdd$.next()),
    },
    ...VIEWS.map<PaletteItem>((view) => ({
      id: `view-${view.id}`,
      group: 'Ir a',
      label: view.label,
      icon: view.icon,
      hint: view.shortcut,
      run: () => this.router.navigate(['/', view.id]),
    })),
    ...this.store.tags().map<PaletteItem>((tag) => ({
      id: `tag-${tag.name}`,
      group: 'Etiquetas',
      label: `#${tag.name}`,
      icon: 'hash',
      run: () => this.router.navigate(['/etiqueta', tag.name]),
    })),
    {
      id: 'theme-light',
      group: 'Preferencias',
      label: 'Usar tema claro',
      icon: 'sun',
      keywords: 'apariencia modo',
      run: () => this.theme.mode.set('light'),
    },
    {
      id: 'theme-dark',
      group: 'Preferencias',
      label: 'Usar tema oscuro',
      icon: 'moon',
      keywords: 'apariencia modo noche',
      run: () => this.theme.mode.set('dark'),
    },
    {
      id: 'theme-system',
      group: 'Preferencias',
      label: 'Usar tema del sistema',
      icon: 'monitor',
      keywords: 'apariencia modo automatico',
      run: () => this.theme.mode.set('system'),
    },
    {
      id: 'shortcuts',
      group: 'Preferencias',
      label: 'Ver atajos de teclado',
      icon: 'keyboard',
      hint: '?',
      keywords: 'ayuda teclas',
      run: () => this.injector.get(ShortcutsDialog).open(),
    },
    {
      id: 'export',
      group: 'Datos',
      label: 'Exportar tareas (JSON)',
      icon: 'download',
      keywords: 'descargar backup copia',
      run: () => this.exportTasks(),
    },
    {
      id: 'clear-completed',
      group: 'Datos',
      label: 'Borrar tareas completadas',
      icon: 'trash',
      keywords: 'limpiar eliminar',
      run: () => {
        const removed = this.store.clearCompleted();
        if (!removed.length) {
          this.toast.show('No hay tareas completadas');
          return;
        }
        this.toast.undoable(`Se borraron ${removed.length} tareas`, () =>
          this.store.restore(...removed),
        );
      },
    },
  ]);

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
        group: 'Tareas',
        label: task.title,
        icon: task.done ? 'circle-check' : 'arrow-right',
        hint: task.done ? 'Completada' : task.due ? formatRelativeDay(task.due, today) : undefined,
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

  private exportTasks(): void {
    const blob = new Blob([JSON.stringify(this.store.tasks(), null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = Object.assign(document.createElement('a'), {
      href: url,
      download: `hecho-tareas-${this.clock.today()}.json`,
    });
    link.click();
    URL.revokeObjectURL(url);
  }
}
