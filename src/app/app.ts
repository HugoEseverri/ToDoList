import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { Dialogs } from './command-palette/dialogs';
import { AppEvents } from './core/app-events';
import { Reminders } from './core/reminders';
import { TaskDetailState } from './core/task-detail-state';
import { Theme } from './core/theme';
import { STATS_SHORTCUT, VIEWS } from './core/views';
import { I18n } from './i18n/i18n';
import { Sidebar } from './layout/sidebar';
import { ToastOutlet } from './layout/toast-outlet';
import { TaskDetail } from './tasks/task-detail';
import { Icon } from './ui/icon';

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Sidebar, ToastOutlet, TaskDetail, Icon],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class App {
  private readonly router = inject(Router);
  private readonly events = inject(AppEvents);
  private readonly theme = inject(Theme);
  private readonly detail = inject(TaskDetailState);
  protected readonly dialogs = inject(Dialogs);
  protected readonly i18n = inject(I18n);
  protected readonly t = this.i18n.t;

  /** Menú lateral abierto (solo en pantallas chicas). */
  protected readonly navOpen = signal(false);

  constructor() {
    // Arranca el chequeo periódico de recordatorios.
    inject(Reminders);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      void this.dialogs.togglePalette();
      return;
    }
    if (event.key === 'Escape' && this.navOpen()) {
      this.navOpen.set(false);
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
    if (this.events.openDialogs() || this.detail.openId()) return;

    const key = event.key.toLowerCase();
    const view = VIEWS.find((v) => v.shortcut === key);
    if (view) {
      this.router.navigate(['/', view.id]);
    } else if (key === STATS_SHORTCUT) {
      this.router.navigate(['/estadisticas']);
    } else if (key === 'n') {
      event.preventDefault();
      this.events.focusQuickAdd$.next();
    } else if (key === 't') {
      this.theme.cycle();
    } else if (key === 'l') {
      this.i18n.toggle();
    } else if (key === '?') {
      void this.dialogs.openShortcuts();
    } else if (key === '/') {
      event.preventDefault();
      void this.dialogs.openPalette();
    }
  }
}
