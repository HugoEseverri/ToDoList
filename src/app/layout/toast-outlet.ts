import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Toast } from '../core/toast';
import { I18n } from '../i18n/i18n';
import { Icon } from '../ui/icon';

@Component({
  selector: 'app-toast-outlet',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="region" role="status" aria-live="polite">
      @if (toast.current(); as current) {
        @for (item of [current]; track item.id) {
          <div class="toast" animate.enter="toast-enter" animate.leave="toast-leave">
            <span class="message">{{ item.message }}</span>
            @if (item.actionLabel) {
              <button type="button" class="action" (click)="toast.runAction()">
                {{ item.actionLabel }}
              </button>
            }
            <button
              type="button"
              class="icon-button close"
              [attr.aria-label]="t('toast.close')"
              (click)="toast.dismiss()"
            >
              <app-icon name="x" [size]="14" />
            </button>
          </div>
        }
      }
    </div>
  `,
  styles: `
    .region {
      position: fixed;
      bottom: max(20px, env(safe-area-inset-bottom));
      left: 50%;
      z-index: 1100;
      transform: translateX(-50%);
      width: max-content;
      max-width: calc(100vw - 32px);
    }
    .toast {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 6px 6px 6px 16px;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-lg);
      background: var(--surface);
      box-shadow: var(--shadow-lg);
    }
    .message {
      font-size: 13px;
    }
    .action {
      height: 28px;
      padding: 0 10px;
      border: 0;
      border-radius: var(--radius-sm);
      background: var(--accent-soft);
      color: var(--accent);
      font-size: 13px;
      font-weight: 600;
    }
    .action:hover {
      background: var(--accent);
      color: var(--accent-contrast);
    }
    .toast-enter {
      animation: toast-in 240ms var(--ease-out);
    }
    .toast-leave {
      animation: toast-out 160ms ease-in forwards;
    }
    @keyframes toast-in {
      from {
        opacity: 0;
        transform: translateY(12px) scale(0.98);
      }
    }
    @keyframes toast-out {
      to {
        opacity: 0;
        transform: translateY(8px);
      }
    }
  `,
})
export class ToastOutlet {
  protected readonly toast = inject(Toast);
  protected readonly t = inject(I18n).t;
}
