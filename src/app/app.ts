import { Dialog } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { CommandPalette } from './command-palette/command-palette';
import { ShortcutsDialog } from './command-palette/shortcuts-dialog';
import { AppEvents } from './core/app-events';
import { Theme } from './core/theme';
import { VIEWS } from './core/views';
import { Sidebar } from './layout/sidebar';
import { ToastOutlet } from './layout/toast-outlet';
import { Icon } from './ui/icon';

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Sidebar, ToastOutlet, Icon],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class App {
  private readonly router = inject(Router);
  private readonly events = inject(AppEvents);
  private readonly theme = inject(Theme);
  private readonly dialog = inject(Dialog);
  protected readonly palette = inject(CommandPalette);
  private readonly shortcuts = inject(ShortcutsDialog);

  /** Menú lateral abierto (solo en pantallas chicas). */
  protected readonly navOpen = signal(false);

  protected onKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.palette.toggle();
      return;
    }
    if (event.key === 'Escape' && this.navOpen()) {
      this.navOpen.set(false);
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
    if (this.dialog.openDialogs.length) return;

    const view = VIEWS.find((v) => v.shortcut === event.key);
    if (view) {
      this.router.navigate(['/', view.id]);
    } else if (event.key === 'n' || event.key === 'N') {
      event.preventDefault();
      this.events.focusQuickAdd$.next();
    } else if (event.key === 't' || event.key === 'T') {
      this.theme.cycle();
    } else if (event.key === '?') {
      this.shortcuts.open();
    } else if (event.key === '/') {
      event.preventDefault();
      this.palette.open();
    }
  }
}
