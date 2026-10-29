import { expect, test } from './fixtures';

test.use({ welcome: true });

test('en el celular la navegación está en un menú deslizable', async ({ app }) => {
  await app.goto('/hoy');
  const sidebarLink = app.page.getByRole('link', { name: /Próximas/ });
  await expect(sidebarLink).not.toBeInViewport();

  await app.page.getByRole('button', { name: 'Abrir menú' }).tap();
  await expect(sidebarLink).toBeInViewport();
  await sidebarLink.tap();
  await expect(app.page).toHaveURL(/\/proximas$/);
  await expect(sidebarLink).not.toBeInViewport();
});

test('las acciones de cada tarea están siempre visibles en pantallas táctiles', async ({ app }) => {
  await app.goto('/hoy');
  const actions = app.page.locator('[data-task-row] .actions').first();
  await expect(actions).toHaveCSS('opacity', '1');
});

test('no hay scroll horizontal', async ({ app }) => {
  for (const path of ['/hoy', '/proximas', '/estadisticas']) {
    await app.goto(path);
    const overflow = await app.page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
