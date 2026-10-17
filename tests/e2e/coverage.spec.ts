import { expect, test, type Page } from '@playwright/test';

async function fresh(page: Page, hash = '#/') {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto(`/${hash}`);
}
const main = (page: Page) => page.locator('#main');

/** AudioContext falso e instrumentado: cuenta contextos y osciladores para medir la limpieza. */
const FAKE_AUDIO = () => {
  const stats = { contexts: 0, closed: 0, started: 0, stopped: 0, disconnected: 0 };
  (window as unknown as { __audio: typeof stats }).__audio = stats;
  class Param { value = 0; setValueAtTime() { return this; } linearRampToValueAtTime() { return this; } }
  class Node { connect(n: unknown) { return n; } disconnect() { stats.disconnected++; } }
  class Osc extends Node { type = 'sine'; frequency = new Param(); onended: (() => void) | null = null; private live = false;
    start() { stats.started++; this.live = true; } stop() { if (this.live) { stats.stopped++; this.live = false; } } }
  class Gain extends Node { gain = new Param(); }
  class Ctx { state = 'running'; currentTime = 0; destination = new Node();
    constructor() { stats.contexts++; }
    createOscillator() { return new Osc(); } createGain() { return new Gain(); }
    resume() { return Promise.resolve(); } close() { this.state = 'closed'; stats.closed++; return Promise.resolve(); } }
  (window as unknown as { AudioContext: unknown }).AudioContext = Ctx;
};

test('S05: canal no elegido no envía y nombra el campo', async ({ page }) => {
  await fresh(page, '#/reservar');
  await page.getByLabel('Es mi primera vez').check();
  await page.locator('#firstName').fill('Ana');
  await page.locator('#lastName').fill('Prueba');
  await page.locator('input[name="slot"]').first().check();
  await page.getByRole('button', { name: 'Enviar solicitud' }).click();
  const summary = page.locator('.error-summary');
  await expect(summary).toContainText('Canal preferido');
  await summary.getByRole('link', { name: /Canal preferido/ }).click();
  await expect(page.locator('#preferredChannel')).toBeFocused();
  await expect(page.locator('#firstName')).toHaveValue('Ana');
  await expect(main(page).getByRole('heading', { name: 'Solicitud enviada' })).toHaveCount(0);
});

test('S02: cupo tomado justo antes de confirmar → error, formulario conservado, sin registro', async ({ page }) => {
  await fresh(page, '#/reservar');
  await page.locator('#serviceTypeId').selectOption('ST-CONTROL');
  await page.locator('input[name="slot"]').first().check();
  await page.getByRole('button', { name: /Simular que otra persona toma este cupo/ }).click();
  await expect(main(page).getByText('Este horario ya no figura como libre')).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar turno' }).click();
  await expect(main(page).getByText('Ese horario no está disponible.')).toBeVisible();
  await expect(main(page).getByText('Tus datos siguen en el formulario.')).toBeVisible();
  await expect(page.locator('#serviceTypeId')).toHaveValue('ST-CONTROL');
  await page.locator('input[name="slot"]').first().check();
  await page.getByRole('button', { name: 'Confirmar turno' }).click();
  await expect(main(page).getByRole('heading', { name: 'Turno confirmado' })).toBeVisible();
});

test('S24: reserva completa a 390 px táctil sin overflow', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await fresh(page, '#/reservar');
  await page.locator('#serviceTypeId').selectOption('ST-LIMPIEZA');
  await page.locator('label.list-item').first().tap();
  const confirm = page.getByRole('button', { name: 'Confirmar turno' });
  await confirm.scrollIntoViewIfNeeded();
  await confirm.tap();
  await expect(main(page).getByRole('heading', { name: 'Turno confirmado' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await ctx.close();
});

test('S36/S38: silenciar y lectura no cortan la tarea; detener cierra el audio y no hay pasos tardíos', async ({ page }) => {
  await page.addInitScript(FAKE_AUDIO);
  await fresh(page, '#/llamada');
  await page.getByLabel('Activar tonos sintéticos suaves (opcional)').check();
  await page.getByRole('button', { name: 'Probar llamada simulada' }).click();
  await expect(page.getByRole('button', { name: 'Cambiar mi control o turno' })).toBeVisible();
  const before = await page.evaluate(() => (window as unknown as { __audio: { started: number } }).__audio.started);
  expect(before).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Silenciar' }).click();
  await expect(page.getByRole('button', { name: 'Activar sonido' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Cambiar mi control o turno' }).click();
  await expect(page.getByRole('button', { name: /Control de ortodoncia/ })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __audio: { started: number } }).__audio.started)).toBe(before);
  await page.getByRole('button', { name: 'Modo lectura', exact: true }).click();
  await expect(main(page).getByText('Sin sonidos. Todo el contenido está en texto.')).toBeVisible();
  await page.getByRole('button', { name: /Control de ortodoncia/ }).click();
  await page.getByRole('button', { name: 'Detener' }).click();
  const lines = await page.locator('.transcript p').count();
  await page.waitForTimeout(800);
  expect(await page.locator('.transcript p').count()).toBe(lines);
  const st = await page.evaluate(() => (window as unknown as { __audio: { contexts: number; closed: number; started: number; stopped: number } }).__audio);
  expect(st.closed).toBe(st.contexts);
  expect(st.stopped).toBe(st.started);
  await page.goto('/#/mis-turnos');
  await expect(page.locator('.turno[data-appointment="A-0012"]')).toContainText('versión 1');
});

test('S34: audio no disponible → aviso y llamada completa en texto', async ({ page }) => {
  await page.addInitScript(() => { delete (window as unknown as { AudioContext?: unknown }).AudioContext; delete (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext; });
  await fresh(page, '#/llamada');
  await page.getByLabel('Activar tonos sintéticos suaves (opcional)').check();
  await page.getByRole('button', { name: 'Probar llamada simulada' }).click();
  await expect(main(page).getByText(/El audio no está disponible o fue bloqueado/)).toBeVisible();
  await page.getByRole('button', { name: 'Tengo una consulta clínica' }).click();
  await expect(page.locator('.call-line')).toContainText('no puedo evaluar síntomas');
});

test('S03: almacenamiento bloqueado → modo memoria con aviso y la demo sigue funcionando', async ({ page }) => {
  await page.addInitScript(() => {
    const deny = () => { throw new DOMException('denegado', 'SecurityError'); };
    Storage.prototype.setItem = deny; Storage.prototype.getItem = deny; Storage.prototype.removeItem = deny;
  });
  await page.goto('/#/mis-turnos');
  await expect(page.locator('.storage-status')).toContainText('Solo en memoria: no se guarda');
  await expect(main(page).getByText(/almacenamiento local no está disponible/)).toBeVisible();
  await page.locator('.turno[data-appointment="A-0012"]').getByRole('button', { name: 'Confirmar asistencia' }).click();
  await expect(main(page).getByText('Asistencia confirmada en esta demo.', { exact: false }).first()).toBeVisible();
});

test('S21/S01: preset vacío muestra estados útiles; sede inexistente ofrece volver', async ({ page }) => {
  await fresh(page, '#/admin/config');
  await page.locator('.list-item', { hasText: 'Sin personas, citas ni movimientos' }).getByRole('button', { name: 'Cargar' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cargar' }).click();
  await expect(page.locator('h1')).toHaveText('Informes calculados');
  await expect(main(page).getByText('Sin datos para este intervalo (n=0)')).toBeVisible();
  await expect(main(page).getByText('Sin datos (n=0)').first()).toBeVisible();
  await page.goto('/#/admin');
  await expect(main(page).getByRole('button', { name: 'Crear turno de muestra' })).toBeVisible();
  await page.goto('/#/sedes/L-XYZ');
  await expect(page.locator('h1')).toHaveText('Sede no encontrada');
  await main(page).getByRole('button', { name: 'Volver a sedes' }).click();
  await expect(page.locator('h1')).toHaveText('Cada consulta tiene un próximo paso.');
});

test('S47: equivalente a zoom 200 % (720 px CSS) sin overflow y menú accesible por teclado', async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 450 });
  await fresh(page);
  for (const hash of ['#/', '#/reservar', '#/whatsapp', '#/admin', '#/admin/espera', '#/admin/config']) {
    await page.goto(`/${hash}`);
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), hash).toBeLessThanOrEqual(0);
  }
  // En pantallas angostas la navegación es la barra inferior; “Más” abre una hoja (popover nativo) operable con teclado.
  const bar = page.getByRole('navigation', { name: 'Navegación inferior' });
  await bar.getByRole('link', { name: 'Bandeja' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('h1')).toHaveText('Bandeja de gestiones');
  const more = bar.getByRole('button', { name: 'Más' });
  await more.focus();
  await page.keyboard.press('Enter');
  const sheet = page.getByRole('dialog', { name: 'Más secciones' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('link', { name: /Informes/ }).click();
  await expect(page.locator('h1')).toHaveText('Informes calculados');
  await expect(sheet).toBeHidden();
});
