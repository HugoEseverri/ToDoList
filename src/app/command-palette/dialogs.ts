import { Injectable, Injector, inject } from '@angular/core';
import { AppEvents } from '../core/app-events';

interface Closable {
  close(): void;
}

/**
 * Abre la paleta de comandos y el diálogo de atajos. Ambos (y el CDK Dialog que usan) se cargan
 * con `import()` la primera vez que se abren, así no pesan en la carga inicial.
 */
@Injectable({ providedIn: 'root' })
export class Dialogs {
  private readonly injector = inject(Injector);
  private readonly events = inject(AppEvents);
  private palette: Closable | null = null;
  private shortcuts: Closable | null = null;

  async openPalette(): Promise<void> {
    if (this.palette) return;
    const { openCommandPalette } = await import('./command-palette');
    this.palette = this.track(openCommandPalette(this.injector), () => (this.palette = null));
  }

  async togglePalette(): Promise<void> {
    if (this.palette) this.palette.close();
    else await this.openPalette();
  }

  async openShortcuts(): Promise<void> {
    if (this.shortcuts) return;
    const { openShortcutsDialog } = await import('./shortcuts-dialog');
    this.shortcuts = this.track(openShortcutsDialog(this.injector), () => (this.shortcuts = null));
  }

  /** Lleva la cuenta de diálogos abiertos y limpia la referencia al cerrarse. */
  private track(
    ref: Closable & { closed: { subscribe(fn: () => void): unknown } },
    onClose: () => void,
  ): Closable {
    this.events.openDialogs.update((n) => n + 1);
    ref.closed.subscribe(() => {
      this.events.openDialogs.update((n) => n - 1);
      onClose();
    });
    return ref;
  }
}
