import { expect, test, type Page } from './fixtures';

// El indicador compacto “Demo” reemplazó a la franja superior (lote 3); su detalle conserva la transparencia.
const BANNER_FACTS = 'Sin envíos reales';
const ROUTES: [string, RegExp][] = [
  ['#/', /Cada consulta tiene un próximo paso/],
  ['#/reservar', /Pedir un turno/],
  ['#/mis-turnos', /Mis turnos/],
  ['#/whatsapp', /WhatsApp de la demo/],
  ['#/llamada', /Llamada simulada/],
  ['#/aprender', /Tu primera visita, con claridad/],
  ['#/admin', /Hoy y agenda/],
  ['#/admin/bandeja', /Bandeja de gestiones/],
  ['#/admin/personas', /Personas y familias/],
  ['#/admin/personas/P-001/odontograma', /Odontograma/],
  ['#/admin/ortodoncia', /Continuidad de ortodoncia/],
  ['#/admin/presupuestos', /Presupuestos y caja ficticia/],
  ['#/admin/espera', /Lista de espera y recordatorios/],
  ['#/admin/tareas', /Tareas/],
  ['#/admin/informes', /Informes calculados/],
  ['#/admin/config', /Configuración y simulador/],
];

function guard(page: Page) {
  const errors: string[] = [];
  const external: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('request', (r) => { if (!r.url().startsWith('http://127.0.0.1:4173/') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) external.push(r.url()); });
  return { errors, external };
}

async function fresh(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/#/');
}

test('los 15 módulos navegan con indicador de demo, sin errores ni red externa', async ({ page }) => {
  const g = guard(page);
  await fresh(page);
  for (const [hash, title] of ROUTES) {
    await page.goto(`/${hash}`);
    await expect(page.locator('h1').first()).toHaveText(title);
    await expect(page.locator('.demo-badge')).toBeVisible();
  }
  await page.locator('.demo-badge').click();
  await expect(page.locator('#demo-badge-info')).toContainText(BANNER_FACTS);
  await expect(page.getByText('Guardado en este dispositivo.').first()).toBeVisible();
  expect(g.errors).toEqual([]);
  expect(g.external).toEqual([]);
});

test('protagonista por WhatsApp: ocupado, original conservado, mismo ID con nueva versión en portal y recepción', async ({ page }) => {
  const g = guard(page);
  await fresh(page);
  await page.goto('/#/whatsapp');
  const input = page.getByLabel('Escribí un mensaje');
  await input.fill('hola!');
  await input.press('Enter');
  await expect(page.getByRole('button', { name: 'Cambiar mi turno' })).toBeVisible();
  await input.fill('Quiero cambiar mi turno');
  await input.press('Enter');
  await page.getByRole('button', { name: /Control de ortodoncia · jue 22\/10/ }).click();
  await page.getByRole('button', { name: /Mismo horario: mar 20\/10 · 10:00/ }).click();
  await expect(page.locator('.bubble.asistente').last()).toContainText('está ocupado');
  await expect(page.locator('.bubble.asistente').last()).toContainText('Conservamos tu turno anterior');
  await page.getByRole('button', { name: /mar 20\/10 · 11:00/ }).click();
  await expect(page.locator('.bubble.asistente').last()).toContainText('versión 1 → 2');
  await page.getByRole('button', { name: 'Confirmar cambio' }).click();
  await expect(page.locator('.bubble.asistente').last()).toContainText('Cambio guardado en esta demo. Recepción ve el mismo turno actualizado. No enviamos mensajes reales.');

  await page.goto('/#/mis-turnos');
  const card = page.locator('.turno[data-appointment="A-0012"]');
  await expect(card).toContainText('20 de oct');
  await expect(card).toContainText('11:00–11:30');
  await expect(card).toContainText('Actualizado recién');
  await expect(card).toContainText('versión 2');

  await page.getByRole('link', { name: 'Ver el mismo turno en recepción' }).click();
  const cell = page.locator('.res-appt[data-appointment="A-0012"]');
  await expect(cell).toBeVisible();
  await expect(cell).toContainText('A-0012 v2');
  await expect(cell).toHaveClass(/is-updated/);

  await page.reload();
  await expect(page.locator('.res-appt[data-appointment="A-0012"]')).toContainText('A-0012 v2');
  await page.goto('/#/mis-turnos');
  await expect(page.locator('.turno[data-appointment="A-0012"]')).toContainText('versión 2');
  expect(g.errors).toEqual([]);
  expect(g.external).toEqual([]);
});

test('reset confirmado repone la seed; storage corrupto avisa y sigue usable', async ({ page }) => {
  await fresh(page);
  await page.goto('/#/admin/config');
  await page.getByRole('button', { name: '+1 día' }).first().click();
  await expect(page.locator('.storage-status')).toContainText('mar 20/10 · 09:00');
  await page.getByRole('button', { name: 'Restablecer demo' }).click();
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.locator('.storage-status')).toContainText('mar 20/10 · 09:00');
  await page.getByRole('button', { name: 'Restablecer demo' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Restablecer' }).click();
  await expect(page.locator('.storage-status')).toContainText('lun 19/10 · 09:00');

  await page.evaluate(() => localStorage.setItem('dentalos.demo.v1', '{"roto":'));
  await page.reload();
  await expect(page.getByText('Los datos guardados de la demo no son válidos')).toBeVisible();
  await expect(page.locator('h1').first()).toBeVisible();
  await page.getByRole('button', { name: 'Restaurar demo inicial' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Restaurar' }).click();
  await expect(page.getByText('Los datos guardados de la demo no son válidos')).toHaveCount(0);
});

test('llamada: silencio no confirma, detener limpia y no deja registros duplicados', async ({ page }) => {
  const g = guard(page);
  await fresh(page);
  await page.goto('/#/llamada');
  await page.getByRole('button', { name: 'Probar llamada simulada' }).click();
  await page.getByRole('button', { name: 'Cambiar mi control o turno' }).click();
  await page.getByRole('button', { name: /Control de ortodoncia/ }).click();
  await page.getByRole('button', { name: 'Simular silencio' }).click();
  await expect(page.locator('.call-line')).toContainText('No escuché una respuesta');
  await page.getByRole('button', { name: 'Detener' }).click();
  await expect(page.getByText('Llamada detenida', { exact: false }).first()).toBeVisible();
  await page.goto('/#/mis-turnos');
  await expect(page.locator('.turno[data-appointment="A-0012"]')).toContainText('versión 1');
  expect(g.errors).toEqual([]);
});

test('móvil 390 px: sin scroll horizontal y agenda como lista', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fresh(page);
  for (const hash of ['#/', '#/reservar', '#/mis-turnos', '#/whatsapp', '#/admin', '#/admin/presupuestos', '#/admin/personas/P-001/odontograma']) {
    await page.goto(`/${hash}`);
    await page.waitForTimeout(100);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, hash).toBeLessThanOrEqual(0);
  }
  await page.goto('/#/admin');
  await page.getByRole('button', { name: 'Semana' }).click();
  await expect(page.locator('.week')).toBeHidden();
  await expect(page.locator('.mobile-only .day-grid')).toBeVisible();
  await page.getByRole('button', { name: 'Por profesional' }).click();
  await expect(page.locator('.res-grid')).toBeHidden();
  await expect(page.locator('.mobile-only .turno').first()).toBeVisible();
});
