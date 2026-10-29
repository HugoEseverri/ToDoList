import AxeBuilder from '@axe-core/playwright';
import { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/** Auditoría automática de accesibilidad (WCAG 2.2 A y AA) con axe-core. */
async function audit(page: Page, label: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const summary = violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`);
  expect(summary, label).toEqual([]);
}

test.use({ welcome: true });

for (const theme of ['light', 'dark'] as const) {
  test.describe(`tema ${theme === 'light' ? 'claro' : 'oscuro'}`, () => {
    test.beforeEach(async ({ page }) => {
      // Sin animaciones: axe mediría el contraste de elementos a mitad de un fundido.
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    });

    for (const path of ['/hoy', '/proximas', '/todas', '/completadas', '/estadisticas']) {
      test(`vista ${path}`, async ({ app }) => {
        await app.goto(path);
        await audit(app.page, path);
      });
    }

    test('panel de detalle abierto', async ({ app }) => {
      await app.goto('/hoy');
      await app
        .task(/detalle/)
        .locator('.title')
        .click();
      await expect(app.page.getByRole('dialog')).toBeVisible();
      await audit(app.page, 'detalle');
    });

    test('paleta de comandos abierta', async ({ app }) => {
      await app.goto('/hoy');
      await app.page.keyboard.press('Control+k');
      await expect(app.page.getByRole('combobox')).toBeVisible();
      await audit(app.page, 'paleta');
    });

    test('carga rápida con texto resaltado', async ({ app }) => {
      await app.goto('/hoy');
      await app.quickAdd.fill('Pagar la luz mañana 18hs #casa !alta');
      await audit(app.page, 'carga rápida');
    });
  });
}
