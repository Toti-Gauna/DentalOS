import { expect, test, type Page } from '@playwright/test';

// Fase 2 del rediseño: navegación en la cabecera, pie con “Ver panel demo”, bottom bar y migas.
async function fresh(page: Page, hash = '#/') {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto(`/${hash}`);
}

test('portal: el menú está dentro de la cabecera y marca la página actual', async ({ page }) => {
  await fresh(page, '#/mis-turnos');
  const nav = page.getByRole('banner').getByRole('navigation', { name: 'Portal de pacientes' });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole('link')).toHaveCount(7);
  await expect(nav.getByRole('link', { name: 'Mis turnos' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('banner').getByRole('link', { name: 'Pedir turno' })).toBeVisible();
  await nav.getByRole('link', { name: 'WhatsApp' }).click();
  await expect(page.locator('h1')).toHaveText('WhatsApp de la demo');
});

test('pie: botón “Ver panel demo” lleva al panel; desde el panel, “Ver portal de pacientes” vuelve', async ({ page }) => {
  await fresh(page);
  const footer = page.getByRole('contentinfo');
  await footer.getByRole('link', { name: 'Ver panel demo' }).click();
  await expect(page.locator('h1')).toHaveText('Hoy y agenda');
  await page.getByRole('contentinfo').getByRole('link', { name: 'Ver portal de pacientes' }).click();
  await expect(page.locator('h1')).toHaveText('Cada consulta tiene un próximo paso.');
});

test('panel: barra lateral agrupada, migas en el encabezado y búsqueda en la cabecera', async ({ page }) => {
  await fresh(page, '#/admin/presupuestos');
  const side = page.getByRole('navigation', { name: 'Panel de la clínica' });
  for (const g of ['Operación', 'Pacientes', 'Gestión']) await expect(side.getByRole('list', { name: g })).toBeVisible();
  await expect(side.getByRole('link', { name: /Presupuestos y caja/ })).toHaveAttribute('aria-current', 'page');
  const crumbs = page.getByRole('navigation', { name: 'Estás en' });
  await expect(crumbs).toContainText('Panel de la clínica');
  await expect(crumbs.locator('[aria-current="page"]')).toHaveText('Presupuestos y caja ficticia');
  await page.getByRole('banner').getByRole('button', { name: 'Buscar (Ctrl K)' }).click();
  await expect(page.getByRole('dialog', { name: 'Buscar e ir a' })).toBeVisible();
});

test('móvil 390 px: bottom bar con 5 destinos, el contenido empieza antes de los 200 px y “Más” abre la hoja', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fresh(page);
  const bar = page.getByRole('navigation', { name: 'Navegación inferior' });
  await expect(bar).toBeVisible();
  await expect(bar.locator(':scope > ul > li')).toHaveCount(5);
  await expect(bar.getByRole('link', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('banner').getByRole('navigation', { name: 'Portal de pacientes' })).toBeHidden();
  const top = await page.locator('#main').evaluate((el) => el.getBoundingClientRect().top);
  expect(top).toBeLessThan(200);
  // La barra no tapa el final del contenido: el cuerpo deja lugar abajo.
  const pad = await page.evaluate(() => parseFloat(getComputedStyle(document.body).paddingBottom));
  expect(pad).toBeGreaterThanOrEqual(68);

  await bar.getByRole('button', { name: 'Más' }).click();
  const sheet = page.getByRole('dialog', { name: 'Más secciones' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('link', { name: 'Ver panel demo' })).toBeVisible();
  await sheet.getByRole('link', { name: /Chicos/ }).click();
  await expect(page.locator('h1')).toHaveText('Sonrisas valientes');
  await expect(sheet).toBeHidden();
  await expect(bar.getByRole('button', { name: 'Más' })).toHaveAttribute('aria-current', 'page');
});

test('móvil: con un campo enfocado (teclado abierto) la bottom bar se oculta', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fresh(page, '#/whatsapp');
  const bar = page.getByRole('navigation', { name: 'Navegación inferior' });
  await expect(bar).toBeVisible();
  await page.getByLabel('Escribí un mensaje').focus();
  await expect(bar).toBeHidden();
  await page.locator('h1').focus();
  await expect(bar).toBeVisible();
});

test('desktop: sin bottom bar y la cabecera de producto queda fija al bajar', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await fresh(page, '#/admin/informes');
  await expect(page.getByRole('navigation', { name: 'Navegación inferior' })).toBeHidden();
  await page.mouse.wheel(0, 1600);
  await page.waitForTimeout(200);
  const top = await page.getByRole('banner').evaluate((el) => el.getBoundingClientRect().top);
  expect(top).toBeGreaterThanOrEqual(0);
  expect(top).toBeLessThan(60);
});
