import { Page, test as base, expect } from '@playwright/test';

/** Jueves 29 de octubre de 2026, 12:00 en Buenos Aires. Todas las fechas de los tests salen de acá. */
export const NOW = new Date('2026-10-29T12:00:00-03:00');

interface Options {
  /** Idioma inicial de la interfaz. */
  lang: 'es' | 'en';
  /** Si es `false`, la app arranca sin las tareas de bienvenida. */
  welcome: boolean;
}

export const test = base.extend<Options & { app: App }>({
  lang: ['es', { option: true }],
  welcome: [false, { option: true }],
  app: async ({ page, lang, welcome }, use) => {
    await page.clock.setFixedTime(NOW);
    // Solo en la primera carga: las recargas del test tienen que conservar los datos.
    await page.addInitScript(
      ({ lang, welcome }) => {
        if (sessionStorage.getItem('e2e-initialized')) return;
        sessionStorage.setItem('e2e-initialized', '1');
        localStorage.clear();
        localStorage.setItem('hecho.lang', lang);
        if (!welcome) localStorage.setItem('hecho.tasks.v1', '[]');
      },
      { lang, welcome },
    );
    await use(new App(page));
  },
});

export { expect };

/** Acciones de alto nivel sobre la app, para que los tests se lean como pasos de usuario. */
export class App {
  constructor(readonly page: Page) {}

  async goto(path = '/hoy'): Promise<void> {
    await this.page.goto(path);
    await expect(this.page.getByRole('heading', { level: 1 })).toBeVisible();
  }

  get quickAdd() {
    return this.page.getByRole('textbox', { name: /Nueva tarea|New task/ });
  }

  async addTask(text: string): Promise<void> {
    await this.quickAdd.fill(text);
    await this.quickAdd.press('Enter');
    await expect(this.quickAdd).toHaveValue('');
  }

  task(title: string | RegExp) {
    return this.page.locator('[data-task-row]').filter({ hasText: title });
  }

  get taskTitles() {
    return this.page.locator('[data-task-row] .title');
  }

  get toast() {
    return this.page.getByRole('status');
  }

  async navigate(name: string | RegExp): Promise<void> {
    await this.page.getByRole('navigation').getByRole('link', { name }).click();
  }
}
