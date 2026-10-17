import { expect, test, type Page } from '@playwright/test';

// Lote 3: shell de la demostración (selector inicial de vista, indicador Demo, botonera flotante, carga con reintento)
// y las dos correcciones de Ignacio (calendario de la reserva y mensajes del chat). Este archivo usa Playwright directo:
// acá sí se prueba la primera visita, con el selector abierto.
const UI = 'dentalos.demo.v1:ui';
async function firstVisit(page: Page, hash = '#/') {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  if (hash !== '#/') await page.evaluate((h) => { location.hash = h; }, hash);
}
async function returning(page: Page, hash = '#/') {
  await page.addInitScript((k) => { if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify({ roleChosen: true })); }, UI);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto(`/${hash}`);
}

test('S51: primera visita → elegir vista lleva a su inicio, se recuerda al recargar y no es un inicio de sesión', async ({ page }) => {
  await firstVisit(page);
  const gate = page.getByRole('dialog', { name: '¿Cómo querés recorrer la demo?' });
  await expect(gate).toBeVisible();
  await expect(gate).toContainText('No es un inicio de sesión');
  await expect(gate.getByRole('button')).toHaveCount(6); // 5 vistas + “Explorar sin elegir”
  await gate.getByRole('button', { name: /^Recepción/ }).click();
  await expect(page).toHaveURL(/#\/admin$/);
  await expect(page.locator('h1')).toHaveText('Hoy y agenda');
  await page.reload();
  await expect(page.getByRole('dialog', { name: '¿Cómo querés recorrer la demo?' })).toHaveCount(0);
  await expect(page.locator('.view-chip')).toContainText('Recepción');
});

test('S51: el selector es opcional: Escape o “Explorar sin elegir” lo cierran y no vuelve', async ({ page }) => {
  await firstVisit(page);
  await expect(page.getByRole('dialog', { name: '¿Cómo querés recorrer la demo?' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '¿Cómo querés recorrer la demo?' })).toHaveCount(0);
  await expect(page.locator('h1')).toHaveText('Cada consulta tiene un próximo paso.');
  await page.reload();
  await expect(page.getByRole('dialog', { name: '¿Cómo querés recorrer la demo?' })).toHaveCount(0);
});

test('S52: cambiar de vista desde la botonera conserva los mismos datos y el tema elegido', async ({ page }) => {
  await returning(page, '#/mis-turnos');
  await page.getByRole('button', { name: 'Tema: Sistema' }).click();
  await page.getByRole('dialog', { name: 'Elegir tema' }).getByRole('button', { name: /Oscuro/ }).click();
  await page.locator('.turno[data-appointment="A-0012"]').getByRole('button', { name: 'Confirmar asistencia' }).click();
  await expect(page.locator('#main').getByText('Asistencia confirmada en esta demo.', { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: /Controles de la demo/ }).click();
  await page.getByRole('dialog', { name: 'Controles de la demo' }).getByRole('button', { name: /^Recepción/ }).click();
  await expect(page).toHaveURL(/#\/admin$/);
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('dentalos.demo.v1') ?? '{}'));
  expect(JSON.stringify(stored)).toContain('A-0012');
  await page.goto('/#/mis-turnos');
  await expect(page.locator('.turno[data-appointment="A-0012"]')).toContainText(/Asistencia confirmada|Confirmado/);
});

test('S49: indicador Demo compacto en la cabecera; sin franja superior; el detalle dice qué es simulado', async ({ page }) => {
  await returning(page);
  await expect(page.locator('.demo-strip')).toHaveCount(0);
  const badge = page.locator('.site-header .demo-badge');
  await expect(badge).toBeVisible();
  const box = await badge.boundingBox();
  expect(box!.height).toBeLessThanOrEqual(32);
  await badge.click();
  const info = page.locator('#demo-badge-info');
  await expect(info).toContainText('Personas, turnos y montos son de muestra.');
  await expect(info).toContainText('Reloj de muestra: lun 19/10 · 09:00');
});

test('S53: botonera por teclado: caso de muestra con confirmación y reinicio que borra solo el espacio propio', async ({ page }) => {
  await returning(page);
  await page.evaluate(() => localStorage.setItem('otra-app', 'intacta'));
  await page.getByRole('button', { name: /Controles de la demo/ }).focus();
  await page.keyboard.press('Enter');
  const panel = page.getByRole('dialog', { name: 'Controles de la demo' });
  await panel.getByLabel('Escenario').selectOption('vacio');
  await panel.getByRole('button', { name: 'Cargar caso' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.locator('h1')).toHaveText('Cada consulta tiene un próximo paso.');
  await page.getByRole('button', { name: /Controles de la demo/ }).click();
  await panel.getByRole('button', { name: 'Cargar caso' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cargar caso' }).click();
  await expect(page.locator('h1')).toHaveText('Informes calculados');
  await page.getByRole('button', { name: /Controles de la demo/ }).click();
  await panel.getByRole('button', { name: 'Reiniciar demo' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Reiniciar' }).click();
  await expect(page.locator('h1')).toHaveText('Cada consulta tiene un próximo paso.');
  expect(await page.evaluate(() => localStorage.getItem('otra-app'))).toBe('intacta');
  await page.goto('/#/admin/config');
  await expect(page.locator('#main')).toContainText('inicial');
});

for (const width of [320, 390]) {
  test(`S54: a ${width} px la botonera no tapa la barra inferior y se oculta con el teclado virtual`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    await returning(page, '#/whatsapp');
    const dock = await page.locator('.demo-dock-btn').boundingBox();
    const bar = await page.locator('.bottombar').boundingBox();
    expect(dock!.y + dock!.height).toBeLessThanOrEqual(bar!.y);
    expect(dock!.x + dock!.width).toBeLessThanOrEqual(width);
    await page.locator('#wa-text').focus();
    await expect(page.locator('.demo-dock-btn')).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
}

test('S50: si una sección del panel no llega, se ve el error y “Reintentar” la recupera sin recargar', async ({ page }) => {
  let fail = true;
  await page.route(/\/assets\/Today-[^/?]+\.js$/, (r) => (fail ? (fail = false, r.abort()) : r.continue()));
  await returning(page, '#/admin');
  await expect(page.getByText('No se pudo cargar esta sección')).toBeVisible();
  await page.evaluate(() => { (window as unknown as { __marca: number }).__marca = 1; });
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.locator('h1')).toHaveText('Hoy y agenda');
  expect(await page.evaluate(() => (window as unknown as { __marca?: number }).__marca)).toBe(1); // sin recarga
});

test('S56: calendario de la reserva: mes real, días sin atención apagados, teclado y horarios del día elegido', async ({ page }) => {
  await returning(page, '#/reservar');
  const cal = page.getByRole('grid', { name: 'octubre de 2026' });
  await expect(cal).toBeVisible();
  await expect(cal.locator('thead th')).toHaveCount(7);
  const sunday = cal.locator('button[data-date="2026-10-25"]');
  await expect(sunday).toHaveAttribute('aria-disabled', 'true');
  await expect(sunday).toHaveAttribute('aria-label', /domingo 25 de octubre: sin atención/);
  const monday = cal.locator('button[data-date="2026-10-19"]');
  await expect(monday).toHaveAttribute('aria-pressed', 'true');
  await monday.focus();
  await page.keyboard.press('ArrowRight');
  await expect(cal.locator('button[data-date="2026-10-20"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(cal.locator('button[data-date="2026-10-20"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.day-slots .slot-day')).toHaveText('martes 20 de octubre');
  const radios = page.locator('input[name="slot"]');
  expect(await radios.count()).toBeGreaterThan(0);
  for (const name of await radios.evaluateAll((els) => els.map((e) => e.closest('label')?.textContent ?? ''))) expect(name).toContain('martes 20 de octubre');
  await page.keyboard.press('PageDown');
  await expect(page.getByRole('grid', { name: 'noviembre de 2026' })).toBeVisible();
});

test('S57: chat con separador por día, hora dentro de la burbuja y estado simulado accesible', async ({ page }) => {
  await returning(page, '#/whatsapp');
  await expect(page.locator('.chat-day').first()).toBeVisible();
  const last = page.locator('.bubble.asistente').last();
  await expect(last.locator('.stamp')).toContainText('09:00');
  await expect(last.locator('.stamp .sr-only')).toContainText('(simulado)');
  await page.locator('#wa-text').fill('quiero cambiar mi turno');
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.locator('.bubble.paciente').last()).toContainText('quiero cambiar mi turno');
  await expect(page.locator('.bubble.paciente').last().locator('.ticks')).toBeVisible();
});
