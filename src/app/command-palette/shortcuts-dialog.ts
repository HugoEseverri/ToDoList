import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { Overlay } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, Injectable, inject } from '@angular/core';
import { Icon } from '../ui/icon';

const GROUPS: { title: string; items: [keys: string[], label: string][] }[] = [
  {
    title: 'General',
    items: [
      [['Ctrl', 'K'], 'Paleta de comandos'],
      [['N'], 'Nueva tarea'],
      [['1'], 'Ir a Hoy'],
      [['2'], 'Ir a Próximas'],
      [['3'], 'Ir a Todas'],
      [['4'], 'Ir a Completadas'],
      [['T'], 'Cambiar tema'],
      [['?'], 'Ver atajos'],
    ],
  },
  {
    title: 'Tarea seleccionada',
    items: [
      [['↑', '↓'], 'Moverse entre tareas'],
      [['Espacio'], 'Completar'],
      [['Enter'], 'Editar'],
      [['P'], 'Cambiar prioridad'],
      [['D'], 'Cambiar fecha'],
      [['Supr'], 'Eliminar'],
    ],
  },
  {
    title: 'Al escribir una tarea',
    items: [
      [['mañana', '18hs'], 'Fecha y hora'],
      [['el viernes'], 'Próximo día de la semana'],
      [['15/11'], 'Fecha exacta'],
      [['#etiqueta'], 'Etiqueta'],
      [['!alta'], 'Prioridad (!alta, !media, !baja)'],
    ],
  },
];

@Injectable({ providedIn: 'root' })
export class ShortcutsDialog {
  private readonly dialog = inject(Dialog);
  private readonly overlay = inject(Overlay);

  open(): void {
    if (
      this.dialog.openDialogs.some((d) => d.componentInstance instanceof ShortcutsDialogComponent)
    )
      return;
    this.dialog.open(ShortcutsDialogComponent, {
      ariaLabelledBy: 'shortcuts-title',
      panelClass: 'app-dialog-panel',
      backdropClass: 'cdk-overlay-dark-backdrop',
      positionStrategy: this.overlay.position().global().centerHorizontally().top('10vh'),
    });
  }
}

@Component({
  selector: 'app-shortcuts-dialog',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="panel">
      <header>
        <h2 id="shortcuts-title">Atajos de teclado</h2>
        <button type="button" class="icon-button" aria-label="Cerrar" (click)="ref.close()">
          <app-icon name="x" [size]="16" />
        </button>
      </header>
      <div class="groups">
        @for (group of groups; track group.title) {
          <section>
            <h3>{{ group.title }}</h3>
            <dl>
              @for (item of group.items; track item[1]) {
                <div class="row">
                  <dt>{{ item[1] }}</dt>
                  <dd>
                    @for (key of item[0]; track key) {
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
      max-height: 80vh;
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
      gap: 4px;
      margin: 0;
    }
  `,
})
export class ShortcutsDialogComponent {
  protected readonly ref = inject(DialogRef);
  protected readonly groups = GROUPS;
}
