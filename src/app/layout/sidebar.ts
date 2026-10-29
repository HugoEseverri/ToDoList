import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Dialogs } from '../command-palette/dialogs';
import { TaskStore } from '../core/task-store';
import { Theme, ThemeMode } from '../core/theme';
import { VIEWS, ViewId } from '../core/views';
import { I18n } from '../i18n/i18n';
import { Icon, IconName } from '../ui/icon';

const THEME_ICONS: Record<ThemeMode, IconName> = { system: 'monitor', light: 'sun', dark: 'moon' };

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
  protected readonly i18n = inject(I18n);
  protected readonly t = this.i18n.t;
  private readonly dialogs = inject(Dialogs);

  /** Se emite al elegir un destino (en celular cierra el menú). */
  readonly navigate = output<void>();

  protected readonly views = computed(() =>
    VIEWS.map((view) => ({ ...view, label: this.t(`view.${view.id}`) })),
  );
  protected readonly themeKey = computed(() => `theme.${this.theme.mode()}` as const);
  protected readonly themeIcon = computed(() => THEME_ICONS[this.theme.mode()]);
  protected readonly counts = computed<Record<ViewId, number | null>>(() => ({
    hoy: this.store.overdue().length + this.store.dueToday().length,
    proximas: this.store.upcoming().length,
    todas: this.store.pending().length,
    completadas: null,
  }));

  protected openPalette(): void {
    this.navigate.emit();
    void this.dialogs.openPalette();
  }

  protected openShortcuts(): void {
    this.navigate.emit();
    void this.dialogs.openShortcuts();
  }
}
