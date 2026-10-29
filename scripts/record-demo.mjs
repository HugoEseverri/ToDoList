// Genera las imágenes del README a partir de la app real:
//   docs/demo.gif          recorrido animado (carga rápida, completar, detalle, paleta)
//   docs/screenshot-*.png  capturas en tema oscuro y claro
//   public/og-image.png    vista previa para cuando se comparte el link
//
// Uso: con la app corriendo (`npm start`), ejecutar `npm run demo`.
// Otra URL: `npm run demo -- http://localhost:4300`.

import { chromium } from '@playwright/test';
import gifenc from 'gifenc';
import { writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const { GIFEncoder, quantize, applyPalette } = gifenc;

const BASE_URL = process.argv[2] ?? 'http://localhost:4200';
const NOW = new Date('2026-10-29T12:00:00-03:00');
const GIF_SIZE = { width: 1040, height: 640 };
/** El GIF se renderiza a 3/4 del tamaño (Chrome dibuja el texto nítido a esa escala). */
const GIF_SCALE = 0.75;
/** ~12 cuadros por segundo alcanzan para una demo fluida y mantienen el archivo liviano. */
const MIN_FRAME_MS = 80;

const browser = await chromium.launch();

async function openApp({ width, height, theme, lang = 'es', scale = 1 }) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
    colorScheme: theme,
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
  });
  const page = await context.newPage();
  await page.clock.setFixedTime(NOW);
  await page.addInitScript((lang) => {
    if (sessionStorage.getItem('demo')) return;
    sessionStorage.setItem('demo', '1');
    localStorage.clear();
    localStorage.setItem('hecho.lang', lang);
    // Un poco de historial para que las estadísticas tengan algo que mostrar.
    const log = {};
    for (let i = 0; i < 150; i++) {
      const day = new Date(2026, 9, 29 - i);
      const iso = day.toLocaleDateString('sv-SE');
      const weekend = day.getDay() === 0 || day.getDay() === 6;
      if (i < 9 || (i * 7919) % 10 > 3) log[iso] = 1 + ((i * 31) % (weekend ? 2 : 7));
    }
    localStorage.setItem('hecho.log.v1', JSON.stringify(log));
  }, lang);
  await page.goto(`${BASE_URL}/hoy`);
  await page.getByRole('heading', { level: 1 }).waitFor();
  return { page, context };
}

const pause = (page, ms) => page.waitForTimeout(ms);

async function typeSlowly(page, text) {
  for (const char of text) {
    await page.keyboard.type(char);
    await pause(page, char === ' ' ? 90 : 55);
  }
}

// ---------- GIF ----------

async function recordGif() {
  const { page, context } = await openApp({ ...GIF_SIZE, theme: 'dark', scale: GIF_SCALE });
  const frames = [];
  let recording = true;
  const capture = (async () => {
    while (recording) {
      const time = Date.now();
      const png = await page.screenshot();
      const last = frames.at(-1);
      // Un cuadro igual al anterior solo alarga la duración del anterior.
      if (last && (time - last.time < MIN_FRAME_MS || last.png.equals(png))) continue;
      frames.push({ time, png });
    }
  })();

  const quickAdd = page.getByRole('textbox', { name: 'Nueva tarea' });
  await pause(page, 900);
  await quickAdd.click();
  await typeSlowly(page, 'Pagar la luz mañana 18hs #casa !alta');
  await pause(page, 1200);
  await page.keyboard.press('Enter');
  await pause(page, 1000);

  await typeSlowly(page, 'Sacar la basura todos los lunes 21hs');
  await pause(page, 1000);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await pause(page, 600);

  const completeMe = page.locator('[data-task-row]').filter({ hasText: 'Arrastrá' });
  await completeMe.getByRole('checkbox').click();
  await pause(page, 1300);

  await page.locator('[data-task-row]').filter({ hasText: 'detalle' }).locator('.title').click();
  await pause(page, 1800);
  await page.keyboard.press('Escape');
  await pause(page, 500);

  await page.keyboard.press('Control+k');
  await pause(page, 500);
  await typeSlowly(page, 'próx');
  await pause(page, 600);
  await page.keyboard.press('Enter');
  await pause(page, 1600);

  await page.keyboard.press('5');
  await pause(page, 2000);

  recording = false;
  await capture;
  await context.close();
  encodeGif(frames, 'docs/demo.gif');
}

function encodeGif(frames, path) {
  const decoded = frames.map((frame) => PNG.sync.read(frame.png));
  // Paleta común (de una muestra de cuadros) para que los colores no "titilen" entre cuadros.
  const sample = decoded.filter((_, i) => i % Math.ceil(decoded.length / 12) === 0);
  const pixels = new Uint8Array(sample.reduce((n, f) => n + f.data.length, 0));
  let offset = 0;
  for (const f of sample) {
    pixels.set(f.data, offset);
    offset += f.data.length;
  }
  const palette = quantize(pixels, 256);

  const gif = GIFEncoder();
  decoded.forEach((frame, i) => {
    const next = frames[i + 1]?.time ?? frames[i].time + 1500;
    gif.writeFrame(applyPalette(frame.data, palette), frame.width, frame.height, {
      palette: i === 0 ? palette : undefined,
      delay: Math.max(20, next - frames[i].time),
    });
  });
  gif.finish();
  writeFileSync(path, gif.bytes());
  console.log(`${path}: ${frames.length} cuadros, ${(gif.bytes().length / 1e6).toFixed(1)} MB`);
}

// ---------- Capturas ----------

async function screenshots() {
  for (const theme of ['dark', 'light']) {
    const { page, context } = await openApp({ width: 1280, height: 760, theme });
    await page.getByRole('textbox', { name: 'Nueva tarea' }).fill('Pagar la luz mañana 18hs #casa !alta');
    await pause(page, 400);
    await page.screenshot({ path: `docs/screenshot-${theme}.png` });
    await context.close();
  }

  const { page, context } = await openApp({ width: 1280, height: 760, theme: 'dark' });
  await page.goto(`${BASE_URL}/estadisticas`);
  await pause(page, 600);
  await page.screenshot({ path: 'docs/screenshot-stats.png' });

  await page.goto(`${BASE_URL}/hoy`);
  await page.locator('[data-task-row]').filter({ hasText: 'detalle' }).locator('.title').click();
  await pause(page, 500);
  await page.screenshot({ path: 'docs/screenshot-detail.png' });
  await context.close();

  const og = await openApp({ width: 1200, height: 630, theme: 'dark' });
  await og.page.getByRole('textbox', { name: 'Nueva tarea' }).fill('Pagar la luz mañana 18hs #casa !alta');
  await pause(og.page, 400);
  await og.page.screenshot({ path: 'public/og-image.png' });
  await og.context.close();
  console.log('Capturas listas en docs/ y public/og-image.png');
}

try {
  await recordGif();
  await screenshots();
} finally {
  await browser.close();
}
