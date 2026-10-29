import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TaskStore } from '../core/task-store';
import { Theme, ThemeMode } from '../core/theme';
import { VIEWS, ViewId } from '../core/views';
import { Icon, IconName } from '../ui/icon';
import { CommandPalette } from '../command-palette/command-palette';
import { ShortcutsDialog } from '../command-palette/shortcuts-dialog';

const THEME_META: Record<ThemeMode, { label: string; icon: IconName }> = {
  system: { label: 'Tema del sistema', icon: 'monitor' },
  light: { label: 'Tema claro', icon: 'sun' },
  dark: { label: 'Tema oscuro', icon: 'moon' },
};

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, Icon],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sidebar {
  protected readonly store = inject(TaskStore);
  protected readonly theme = inject(Theme);
  private readonly palette = inject(CommandPalette);
  private readonly shortcuts = inject(ShortcutsDialog);

  /** Se emite al elegir un destino (en celular cierra el menú). */
  readonly navigate = output<void>();

  protected readonly views = VIEWS;
  protected readonly themeMeta = computed(() => THEME_META[this.theme.mode()]);
  protected readonly counts = computed<Record<ViewId, number | null>>(() => ({
    hoy: this.store.overdue().length + this.store.dueToday().length,
    proximas: this.store.upcoming().length,
    todas: this.store.pending().length,
    completadas: null,
  }));

  protected openPalette(): void {
    this.navigate.emit();
    this.palette.open();
  }

  protected openShortcuts(): void {
    this.navigate.emit();
    this.shortcuts.open();
  }
}
