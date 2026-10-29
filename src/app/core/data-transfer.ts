import { DOCUMENT, Injectable, inject } from '@angular/core';
import { I18n } from '../i18n/i18n';
import { Clock } from './clock';
import { TaskStore } from './task-store';
import { normalizeAll } from './task-storage';
import { Toast } from './toast';

/** Exportar e importar tareas como JSON, y cargar las tareas de ejemplo. */
@Injectable({ providedIn: 'root' })
export class DataTransfer {
  private readonly document = inject(DOCUMENT);
  private readonly store = inject(TaskStore);
  private readonly clock = inject(Clock);
  private readonly i18n = inject(I18n);
  private readonly toast = inject(Toast);

  export(): void {
    const data = { app: 'hecho', version: 1, tasks: this.store.tasks() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = Object.assign(this.document.createElement('a'), {
      href: url,
      download: `hecho-${this.clock.today()}.json`,
    });
    link.click();
    URL.revokeObjectURL(url);
  }

  /** Abre el selector de archivos del sistema. */
  pickFile(): void {
    const input = Object.assign(this.document.createElement('input'), {
      type: 'file',
      accept: 'application/json,.json',
    });
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (file) void this.importFile(file);
    });
    input.click();
  }

  async importFile(file: Blob): Promise<void> {
    const t = this.i18n.t;
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      this.toast.show(t('data.importError'));
      return;
    }
    // Acepta tanto el formato exportado ({ tasks: [...] }) como una lista suelta.
    const list = Array.isArray(parsed) ? parsed : (parsed as { tasks?: unknown })?.tasks;
    const tasks = Array.isArray(list) ? normalizeAll(list) : [];
    if (!tasks.length) {
      this.toast.show(t('data.importEmpty'));
      return;
    }
    const undo = this.store.addMany(tasks);
    this.toast.show(this.i18n.plural('data.imported', tasks.length), {
      actionLabel: t('task.undo'),
      action: undo,
    });
  }

  addExamples(): void {
    const undo = this.store.addWelcomeTasks();
    this.toast.show(this.i18n.t('data.examplesAdded'), {
      actionLabel: this.i18n.t('task.undo'),
      action: undo,
    });
  }
}
