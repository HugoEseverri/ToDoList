import { expect, test } from './fixtures';

test.describe('primera visita', () => {
  test.use({ welcome: true });

  test('muestra las tareas de bienvenida en Hoy', async ({ app }) => {
    await app.goto('/');
    await expect(app.page).toHaveURL(/\/hoy$/);
    await expect(app.page.getByRole('heading', { name: 'Hoy', level: 1 })).toBeVisible();
    await expect(app.page.getByText('Jueves 29 de octubre')).toBeVisible();
    await expect(app.task(/paleta de comandos/)).toBeVisible();
  });
});

test.describe('tareas', () => {
  test('la carga rápida interpreta lenguaje natural y resalta lo que reconoce', async ({ app }) => {
    await app.goto('/todas');
    await app.quickAdd.fill('Pagar la luz mañana 18hs #casa !alta');

    const mirror = app.page.locator('.mirror');
    await expect(mirror.locator('.token-date')).toHaveText('mañana');
    await expect(mirror.locator('.token-time')).toHaveText('18hs');
    await expect(mirror.locator('.token-tag')).toHaveText('#casa');
    await expect(mirror.locator('.token-priority-3')).toHaveText('!alta');

    await app.quickAdd.press('Enter');
    const task = app.task('Pagar la luz');
    await expect(task).toContainText('Mañana');
    await expect(task).toContainText('18:00');
    await expect(task).toContainText('#casa');
    await expect(app.page.getByRole('link', { name: /casa/ })).toBeVisible();
  });

  test('avisa cuando la tarea nueva va a otra vista y permite ir a verla', async ({ app }) => {
    await app.goto('/hoy');
    await app.addTask('Reunión el viernes a las 10');
    await expect(app.toast).toContainText('Agregada a Próximas');
    await app.toast.getByRole('button', { name: 'Ver' }).click();
    await expect(app.page).toHaveURL(/\/proximas$/);
    await expect(app.task('Reunión')).toContainText('10:00');
  });

  test('completar, deshacer y ver en Completadas', async ({ app }) => {
    await app.goto('/todas');
    await app.addTask('Comprar pan');
    await app.task('Comprar pan').getByRole('checkbox').click();
    await expect(app.task('Comprar pan')).toHaveCount(0);

    await app.toast.getByRole('button', { name: 'Deshacer' }).click();
    await expect(app.task('Comprar pan')).toBeVisible();

    await app.task('Comprar pan').getByRole('checkbox').click();
    await app.navigate('Completadas');
    await expect(app.task('Comprar pan')).toBeVisible();
  });

  test('las tareas se conservan al recargar la página', async ({ app }) => {
    await app.goto('/todas');
    await app.addTask('No me pierdas #importante');
    await app.page.reload();
    await expect(app.task('No me pierdas')).toBeVisible();
    await expect(app.task('No me pierdas')).toContainText('#importante');
  });

  test('una tarea repetitiva pasa a su próxima fecha al completarla', async ({ app }) => {
    await app.goto('/hoy');
    await app.addTask('Regar las plantas todos los días');
    const task = app.task('Regar las plantas');
    await expect(task).toContainText('Todos los días');

    await task.getByRole('checkbox').click();
    await expect(app.toast).toContainText('próxima: Mañana');
    await app.navigate('Próximas');
    await expect(app.task('Regar las plantas')).toBeVisible();
    await app.navigate('Completadas');
    await expect(app.task('Regar las plantas')).toBeVisible();
  });

  test('arrastrar y soltar cambia el orden', async ({ app }) => {
    await app.goto('/todas');
    for (const title of ['Tercera', 'Segunda', 'Primera']) await app.addTask(title);
    await expect(app.taskTitles).toHaveText(['Primera', 'Segunda', 'Tercera']);

    const source = await app.task('Primera').boundingBox();
    const target = await app.task('Tercera').boundingBox();
    const page = app.page;
    await page.mouse.move(source!.x + 200, source!.y + source!.height / 2);
    await page.mouse.down();
    // El CDK necesita varios movimientos para detectar el arrastre.
    for (let step = 1; step <= 10; step++) {
      await page.mouse.move(
        source!.x + 200,
        source!.y + ((target!.y - source!.y + 10) * step) / 10,
      );
    }
    await page.mouse.up();

    await expect(app.taskTitles).toHaveText(['Segunda', 'Tercera', 'Primera']);
    await page.reload();
    await expect(app.taskTitles).toHaveText(['Segunda', 'Tercera', 'Primera']);
  });

  test('se puede usar entera con el teclado', async ({ app }) => {
    await app.goto('/todas');
    await app.page.keyboard.press('n');
    await expect(app.quickAdd).toBeFocused();
    await app.page.keyboard.type('Primera');
    await app.page.keyboard.press('Enter');
    await app.page.keyboard.type('Segunda');
    await app.page.keyboard.press('Enter');
    await app.page.keyboard.press('Escape');

    await app.task('Segunda').focus();
    await app.page.keyboard.press('ArrowDown');
    await expect(app.task('Primera')).toBeFocused();
    await app.page.keyboard.press('p');
    await expect(app.task('Primera').locator('.check')).toHaveClass(/priority-3/);
    await app.page.keyboard.press('Delete');
    await expect(app.task('Primera')).toHaveCount(0);
    await expect(app.task('Segunda')).toBeFocused();
  });
});

test.describe('panel de detalle', () => {
  test('notas y subtareas', async ({ app }) => {
    await app.goto('/todas');
    await app.addTask('Preparar el viaje');
    await app.task('Preparar el viaje').locator('.title').click();

    const panel = app.page.getByRole('dialog', { name: 'Detalle de la tarea' });
    await expect(panel).toBeVisible();
    await panel.getByRole('textbox', { name: 'Notas' }).fill('No olvidar el pasaporte');
    const newSubtask = panel.getByRole('textbox', { name: 'Agregar subtarea…' });
    await newSubtask.fill('Reservar hotel');
    await newSubtask.press('Enter');
    await newSubtask.fill('Comprar adaptador');
    await newSubtask.press('Enter');
    await panel.getByRole('checkbox', { name: 'Reservar hotel' }).check();

    await app.page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(app.task('Preparar el viaje')).toContainText('1/2');
    await expect(app.task('Preparar el viaje')).toContainText('Tiene notas');
  });
});

test.describe('paleta de comandos', () => {
  test('busca una tarea y lleva hasta ella', async ({ app }) => {
    await app.goto('/hoy');
    await app.addTask('Llamar al banco el lunes');
    await app.page.keyboard.press('Control+k');

    const palette = app.page.getByRole('combobox');
    await palette.fill('banco');
    await app.page.keyboard.press('Enter');
    await expect(app.page).toHaveURL(/\/proximas$/);
    await expect(app.task('Llamar al banco')).toBeFocused();
  });

  test('ejecuta comandos: cambiar tema', async ({ app }) => {
    await app.goto('/hoy');
    await app.page.keyboard.press('Control+k');
    await app.page.getByRole('combobox').fill('oscuro');
    await app.page.keyboard.press('Enter');
    await expect(app.page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
});

test.describe('idioma', () => {
  test('cambia toda la interfaz y el parser a inglés', async ({ app }) => {
    await app.goto('/hoy');
    await app.page.keyboard.press('l');
    await expect(app.page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();
    await expect(app.page).toHaveTitle('Today · Hecho');

    await app.addTask('Call Ana tomorrow 10am #work');
    await expect(app.toast).toContainText('Added to Upcoming');
    await app.navigate('Upcoming');
    await expect(app.task('Call Ana')).toContainText('10:00');
  });
});
