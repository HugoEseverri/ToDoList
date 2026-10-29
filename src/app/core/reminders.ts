import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { I18n } from '../i18n/i18n';
import { Clock } from './clock';
import { toIsoDate } from './dates';
import { Task } from './task';
import { TaskStore } from './task-store';
import { Toast } from './toast';

const ENABLED_KEY = 'hecho.reminders';
const NOTIFIED_KEY = 'hecho.reminders.sent';
const CHECK_INTERVAL_MS = 30_000;
/** No avisa de horarios que pasaron hace más de esto (por ejemplo, si la app estuvo cerrada). */
const GRACE_MS = 10 * 60_000;

/**
 * Avisa con una notificación del sistema cuando llega la hora de una tarea.
 * Sin un servidor de push, funciona mientras la app esté abierta (pestaña o PWA instalada).
 */
@Injectable({ providedIn: 'root' })
export class Reminders {
  private readonly store = inject(TaskStore);
  private readonly clock = inject(Clock);
  private readonly i18n = inject(I18n);
  private readonly toast = inject(Toast);

  readonly supported = typeof window !== 'undefined' && 'Notification' in window;
  readonly enabled = signal(this.supported && readFlag() && Notification.permission === 'granted');
  private readonly notified = new Set<string>(readNotified());

  constructor() {
    const id = setInterval(() => this.check(), CHECK_INTERVAL_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }

  async toggle(): Promise<void> {
    const t = this.i18n.t;
    if (!this.supported) {
      this.toast.show(t('reminders.unsupported'));
      return;
    }
    if (this.enabled()) {
      this.setEnabled(false);
      this.toast.show(t('reminders.disabled'));
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      this.toast.show(t('reminders.denied'));
      return;
    }
    this.setEnabled(true);
    this.toast.show(t('reminders.enabled'));
    this.check();
  }

  /** Busca tareas cuya hora acaba de llegar y las notifica una sola vez. */
  check(): void {
    if (!this.enabled()) return;
    const now = this.clock.now().getTime();
    for (const task of this.store.pending()) {
      const at = reminderTime(task);
      if (at === null || at > now || now - at > GRACE_MS) continue;
      const key = `${task.id}@${task.due}T${task.time}`;
      if (this.notified.has(key)) continue;
      this.notified.add(key);
      void this.notify(task);
    }
    this.persistNotified();
  }

  private async notify(task: Task): Promise<void> {
    const options: NotificationOptions = {
      body: this.i18n.t('reminders.body', { time: task.time! }),
      icon: 'icons/icon-192x192.png',
      badge: 'icons/icon-96x96.png',
      tag: task.id,
    };
    // Con service worker la notificación funciona también en Android; si no, se usa la API directa.
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) await registration.showNotification(task.title, options);
    else new Notification(task.title, options);
  }

  private setEnabled(value: boolean): void {
    this.enabled.set(value);
    try {
      localStorage.setItem(ENABLED_KEY, String(value));
    } catch {
      // Sin storage: dura la sesión.
    }
  }

  private persistNotified(): void {
    // Guarda solo las de hoy para que la lista no crezca indefinidamente.
    const today = toIsoDate(this.clock.now());
    const recent = [...this.notified].filter((key) => key.includes(`@${today}`));
    try {
      localStorage.setItem(NOTIFIED_KEY, JSON.stringify(recent));
    } catch {
      // Sin storage: se podrían repetir avisos tras recargar.
    }
  }
}

function reminderTime(task: Task): number | null {
  if (!task.due || !task.time) return null;
  const [y, m, d] = task.due.split('-').map(Number);
  const [h, min] = task.time.split(':').map(Number);
  return new Date(y, m - 1, d, h, min).getTime();
}

function readFlag(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === 'true';
  } catch {
    return false;
  }
}

function readNotified(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(NOTIFIED_KEY) ?? '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}
