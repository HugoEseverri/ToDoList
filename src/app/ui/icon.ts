import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type Shape =
  | { d: string }
  | { cx: number; cy: number; r: number }
  | { x: number; y: number; w: number; h: number; rx: number };

// Trazos basados en Lucide (https://lucide.dev, licencia ISC).
const ICONS = {
  sun: [
    { cx: 12, cy: 12, r: 4 },
    {
      d: 'M12 2v2M12 20v2m-7.07-17.07 1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41',
    },
  ],
  moon: [{ d: 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z' }],
  monitor: [{ x: 2, y: 3, w: 20, h: 14, rx: 2 }, { d: 'M8 21h8M12 17v4' }],
  calendar: [{ x: 3, y: 4, w: 18, h: 18, rx: 2 }, { d: 'M16 2v4M8 2v4M3 10h18' }],
  inbox: [
    { d: 'M22 12h-6l-2 3h-4l-2-3H2' },
    {
      d: 'M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z',
    },
  ],
  'circle-check': [{ cx: 12, cy: 12, r: 10 }, { d: 'm9 12 2 2 4-4' }],
  check: [{ d: 'M20 6 9 17l-5-5' }],
  hash: [{ d: 'M4 9h16M4 15h16M10 3 8 21M16 3l-2 18' }],
  search: [{ cx: 11, cy: 11, r: 8 }, { d: 'm21 21-4.3-4.3' }],
  flag: [{ d: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7' }],
  trash: [
    { d: 'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' },
  ],
  plus: [{ d: 'M5 12h14M12 5v14' }],
  x: [{ d: 'M18 6 6 18M6 6l12 12' }],
  menu: [{ d: 'M4 6h16M4 12h16M4 18h16' }],
  clock: [{ cx: 12, cy: 12, r: 10 }, { d: 'M12 6v6l4 2' }],
  keyboard: [
    { x: 2, y: 4, w: 20, h: 16, rx: 2 },
    { d: 'M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10' },
  ],
  command: [{ d: 'M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3' }],
  download: [{ d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3' }],
  'arrow-right': [{ d: 'M5 12h14M12 5l7 7-7 7' }],
  sparkles: [
    {
      d: 'M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0L14.06 8.5A2 2 0 0 0 15.5 9.94l6.14 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z',
    },
  ],
} satisfies Record<string, Shape[]>;

export type IconName = keyof typeof ICONS;

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    <svg
      viewBox="0 0 24 24"
      [attr.width]="size()"
      [attr.height]="size()"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      @for (shape of shapes(); track $index) {
        @if ('d' in shape) {
          <path [attr.d]="shape.d" />
        } @else if ('r' in shape) {
          <circle [attr.cx]="shape.cx" [attr.cy]="shape.cy" [attr.r]="shape.r" />
        } @else {
          <rect
            [attr.x]="shape.x"
            [attr.y]="shape.y"
            [attr.width]="shape.w"
            [attr.height]="shape.h"
            [attr.rx]="shape.rx"
          />
        }
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-shrink: 0;
    }
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(16);
  protected readonly shapes = computed<Shape[]>(() => ICONS[this.name()]);
}
