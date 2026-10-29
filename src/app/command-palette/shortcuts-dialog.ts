import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { Overlay } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, Injector, computed, inject } from '@angular/core';
import { STATS_SHORTCUT, VIEWS } from '../core/views';
import { I18n } from '../i18n/i18n';
import { Icon } from '../ui/icon';

export function openShortcutsDialog(injector: Injector): DialogRef<unknown, ShortcutsDialog> {
  return injector.get(Dialog).open(ShortcutsDialog, {
    ariaLabelledBy: 'shortcuts-title',
    panelClass: 'app-dialog-panel',
    backdropClass: 'cdk-overlay-dark-backdrop',
    positionStrategy: injector.get(Overlay).position().global().centerHorizontally().top('8vh'),
  });
}

@Component({
  selector: 'app-shortcuts-dialog',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="panel">
      <header>
        <h2 id="shortcuts-title">{{ t('shortcuts.title') }}</h2>
        <button
          type="button"
          class="icon-button"
          [attr.aria-label]="t('detail.close')"
          (click)="ref.close()"
        >
          <app-icon name="x" [size]="16" />
        </button>
      </header>
      <div class="groups">
        @for (group of groups(); track group.title) {
          <section>
            <h3>{{ group.title }}</h3>
            <dl>
              @for (item of group.items; track item.label) {
                <div class="row">
                  <dt>{{ item.label }}</dt>
                  <dd>
                    @for (key of item.keys; track key) {
                      <kbd>{{ key }}</kbd>
                    }
                  </dd>
                </div>
              }
            </dl>
          </section>
        }
      </div>
    </div>
  `,
  styles: `
    .panel {
      max-height: 84vh;
      overflow-y: auto;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-lg);
      background: var(--surface);
      box-shadow: var(--shadow-lg);
      animation: dialog-in 180ms var(--ease-out);
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 14px 14px 20px;
      border-bottom: 1px solid var(--border);
    }
    h2 {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
    }
    .groups {
      display: grid;
      gap: 20px;
      padding: 16px 20px 20px;
    }
    h3 {
      margin: 0 0 6px;
      color: var(--text-faint);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    dl {
      margin: 0;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 6px 0;
      border-bottom: 1px solid var(--border);
    }
    .row:last-child {
      border-bottom: 0;
    }
    dt {
      color: var(--text-muted);
    }
    dd {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 4px;
      margin: 0;
    }
  `,
})
export class ShortcutsDialog {
  protected readonly ref = inject(DialogRef);
  private readonly i18n = inject(I18n);
  protected readonly t = this.i18n.t;

  protected readonly groups = computed(() => {
    const t = this.t;
    const views = [
      ...VIEWS.map((v) => ({
        keys: [v.shortcut],
        label: t('shortcuts.goto', { view: t(`view.${v.id}`) }),
      })),
      { keys: [STATS_SHORTCUT], label: t('shortcuts.goto', { view: t('view.estadisticas') }) },
    ];
    return [
      {
        title: t('shortcuts.general'),
        items: [
          { keys: ['Ctrl', 'K'], label: t('shortcuts.palette') },
          { keys: ['N'], label: t('shortcuts.new') },
          ...views,
          { keys: ['T'], label: t('shortcuts.theme') },
          { keys: ['L'], label: t('shortcuts.language') },
          { keys: ['?'], label: t('shortcuts.help') },
        ],
      },
      {
        title: t('shortcuts.task'),
        items: [
          { keys: ['↑', '↓'], label: t('shortcuts.move') },
          { keys: [t('key.space')], label: t('shortcuts.complete') },
          { keys: ['Enter'], label: t('shortcuts.open') },
          { keys: ['E'], label: t('shortcuts.edit') },
          { keys: ['P'], label: t('shortcuts.priority') },
          { keys: ['D'], label: t('shortcuts.date') },
          { keys: [t('key.delete')], label: t('shortcuts.delete') },
        ],
      },
      {
        title: t('shortcuts.typing'),
        items: [
          { keys: [t('shortcuts.ex.dateTime')], label: t('shortcuts.dateTime') },
          { keys: [t('shortcuts.ex.weekday')], label: t('shortcuts.weekday') },
          { keys: [t('shortcuts.ex.exactDate')], label: t('shortcuts.exactDate') },
          { keys: [t('shortcuts.ex.repeat')], label: t('shortcuts.repeat') },
          { keys: [t('shortcuts.ex.tag')], label: t('shortcuts.tag') },
          { keys: [t('shortcuts.ex.prio')], label: t('shortcuts.prio') },
        ],
      },
    ];
  });
}
