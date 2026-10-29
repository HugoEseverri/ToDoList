import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';

/** Eventos de interfaz entre componentes que no se conocen entre sí (atajos, paleta de comandos). */
@Injectable({ providedIn: 'root' })
export class AppEvents {
  readonly focusQuickAdd$ = new Subject<void>();
  /**
   * Tarea a enfocar. Es un signal (y no un evento) porque se pide antes de navegar
   * y la vista de destino la consume recién cuando termina de renderizar.
   */
  readonly taskToFocus = signal<string | null>(null);
}
