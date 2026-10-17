import { expect, test, type Page } from './fixtures';

// Fase 2c: componentes nativos de la plataforma, fondo animado y pulido premium.
async function fresh(page: Page, hash = '#/') {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto(`/${hash}`);
}

test('paleta ⌘K/Ctrl+K: dialog nativo modal, busca por ID y navega; Escape cierra', async ({ page }) => {
  await fresh(page, '#/admin');
  await expect(page.locator('h1')).toHaveText('Hoy y agenda');
  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: 'Buscar e ir a' });
  await expect(palette).toBeVisible();
  expect(await page.locator('dialog.palette-dialog').evaluate((d) => d.matches(':modal'))).toBe(true);
  const box = palette.getByRole('combobox', { name: /Buscar módulo o persona/ });
  await expect(box).toBeFocused();
  await box.fill('P-008');
  await expect(palette.getByRole('option').first()).toContainText('Ana Paredes');
  await page.keyboard.press('Enter');
  await expect(palette).toHaveCount(0);
  await expect(page.locator('h1')).toHaveText('Ana Paredes');
  await expect(page.locator('h1')).toBeFocused();

  // Botón visible para quien no usa atajos; Escape cierra sin navegar.
  await page.getByRole('button', { name: 'Buscar (Ctrl K)' }).click();
  await expect(palette).toBeVisible();
  await page.keyboard.type('odontograma');
  await page.keyboard.press('Escape');
  await expect(palette).toHaveCount(0);
  await expect(page.locator('h1')).toHaveText('Ana Paredes');
  await expect(page.getByRole('button', { name: 'Buscar (Ctrl K)' })).toBeFocused();
});

test('paleta: las flechas cambian la opción activa (aria-activedescendant) y Enter navega', async ({ page }) => {
  await fresh(page, '#/admin');
  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: 'Buscar e ir a' });
  const box = palette.getByRole('combobox');
  await box.fill('odontograma');
  await expect(palette.getByRole('option', { selected: true })).toHaveText(/^Odontograma/);
  const first = await box.getAttribute('aria-activedescendant');
  await page.keyboard.press('ArrowDown');
  await expect(palette.getByRole('option', { selected: true })).toContainText('Odontograma de');
  expect(await box.getAttribute('aria-activedescendant')).not.toBe(first);
  await page.keyboard.press('Enter');
  await expect(page.locator('h1')).toHaveText('Odontograma');
  await expect(page.locator('#main .page-head .eyebrow')).toContainText('P-');
});

test('drawer y confirmación sobre <dialog> nativo: modal, fondo inerte, foco y Escape', async ({ page }) => {
  await fresh(page, '#/admin');
  const opener = page.getByRole('button', { name: 'Alta manual' });
  await opener.click();
  const drawer = page.getByRole('dialog', { name: 'Alta manual de turno' });
  await expect(drawer).toBeVisible();
  expect(await page.locator('dialog.drawer-dialog').evaluate((d) => d.matches(':modal'))).toBe(true);
  // El resto de la página es inerte mientras el modal está abierto.
  expect(await page.evaluate(() => document.elementFromPoint(400, 400)?.closest('dialog') !== null || document.elementFromPoint(400, 400) === document.documentElement)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
  await expect(opener).toBeFocused();

  await page.goto('/#/chicos');
  await page.getByRole('button', { name: 'Vaciar álbum' }).click();
  const confirm = page.getByRole('alertdialog', { name: '¿Vaciar el álbum?' });
  await expect(confirm).toBeVisible();
  await expect(confirm.getByRole('button', { name: 'Cancelar' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(confirm).toHaveCount(0);
});

test('popovers nativos de la demo: indicador con alcance y guardado; botonera con vista, caso y sonido; Escape cierra', async ({ page }) => {
  await fresh(page);
  const badge = page.locator('.demo-badge');
  await expect(badge).toBeVisible();
  await badge.click();
  const info = page.locator('#demo-badge-info');
  expect(await info.evaluate((el) => el.matches(':popover-open'))).toBe(true);
  await expect(info).toContainText('No diagnostica ni recomienda tratamientos.');
  await expect(info).toContainText('Guardado en este dispositivo.');
  await expect(info).toContainText('Sin envíos reales');
  await page.keyboard.press('Escape');
  await expect(info).toBeHidden();

  await page.getByRole('button', { name: /Controles de la demo/ }).click();
  const panel = page.locator('#demo-dock-panel');
  expect(await panel.evaluate((el) => el.matches(':popover-open'))).toBe(true);
  await expect(panel.getByRole('heading', { name: /Vista/ })).toBeVisible();
  await expect(panel.getByLabel('Escenario')).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Sonidos: no' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(badge).toBeVisible();
});

test('preguntas frecuentes: acordeón exclusivo nativo (<details name>)', async ({ page }) => {
  await fresh(page);
  const items = page.locator('.faq details');
  await expect(items).toHaveCount(5);
  await expect(items.nth(0)).toHaveAttribute('open', '');
  await items.nth(2).locator('summary').click();
  await expect(items.nth(2)).toHaveAttribute('open', '');
  await expect(items.nth(0)).not.toHaveAttribute('open', '');
  await expect(items.nth(2)).toContainText('no evalúa síntomas');
});

test('fondo animado: decorativo, se anima y queda quieto con movimiento reducido', async ({ page }) => {
  await fresh(page);
  const amb = page.locator('.ambient');
  await expect(amb).toHaveAttribute('aria-hidden', 'true');
  expect(await page.locator('.blob.b1').evaluate((el) => getComputedStyle(el).animationName)).toBe('drift1');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.locator('.blob.b1').evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  await page.goto('/#/chicos');
  await expect(page.locator('.ambient .fizz')).toHaveCount(12);
  expect(await page.locator('.ambient .fizz').first().evaluate((el) => getComputedStyle(el).display)).toBe('none');
});

test('View Transitions: se usan al navegar y se omiten con movimiento reducido', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __vt: number };
    w.__vt = 0;
    const orig = document.startViewTransition?.bind(document);
    if (orig) document.startViewTransition = ((cb: () => void) => { w.__vt++; return orig(cb); }) as typeof document.startViewTransition;
  });
  await fresh(page);
  const count = () => page.evaluate(() => (window as unknown as { __vt: number }).__vt);
  const supported = await page.evaluate(() => typeof document.startViewTransition === 'function');
  test.skip(!supported, 'El navegador no soporta View Transitions');
  await page.getByRole('navigation', { name: 'Portal de pacientes' }).getByRole('link', { name: 'Reservar' }).click();
  await expect(page.locator('h1')).toHaveText('Pedir un turno');
  expect(await count()).toBeGreaterThan(0);
  const before = await count();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('navigation', { name: 'Portal de pacientes' }).getByRole('link', { name: 'Mis turnos' }).click();
  await expect(page.locator('h1')).toHaveText('Mis turnos');
  expect(await count()).toBe(before);
});

test('reserva: horarios en grilla con hora destacada y nombre accesible completo', async ({ page }) => {
  await fresh(page, '#/reservar');
  await expect(page.locator('.slot-grid').first()).toBeVisible();
  const radio = page.getByRole('radio', { name: /lunes 19 de octubre, 11:00/ }).first();
  await radio.check();
  await expect(radio).toBeChecked();
  expect(await radio.evaluate((el) => getComputedStyle(el).appearance)).toBe('none');
});

test('panel: avatares de personas, barras de datos en informes y negativos marcados en la caja', async ({ page }) => {
  await fresh(page, '#/admin/personas');
  await expect(page.locator('#main .person-avatar').first()).toBeVisible();
  await expect(page.locator('#main .person-avatar').first()).toHaveAttribute('aria-hidden', 'true');
  await page.goto('/#/admin/informes');
  await expect(page.locator('.databar')).toHaveCount(11);
  await page.goto('/#/admin/presupuestos');
  await expect(page.locator('td.neg').first()).toContainText('−');
});

test('encabezados ilustrados del portal y estado vacío con personaje', async ({ page }) => {
  await fresh(page, '#/reservar');
  await expect(page.locator('.page-art')).toHaveAttribute('aria-hidden', 'true');
  for (const r of ['#/mis-turnos', '#/whatsapp', '#/llamada', '#/aprender', '#/sedes/L-CEN']) {
    await page.goto(`/${r}`);
    await expect(page.locator('.page-art svg').first()).toBeVisible();
  }
  await page.goto('/#/mis-turnos');
  await expect(page.locator('.empty .character')).toBeVisible();
});
