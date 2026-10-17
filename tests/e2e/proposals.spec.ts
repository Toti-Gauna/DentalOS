import { expect, test, type Page } from '@playwright/test';

// Lote 2: página de propuestas visuales (#/propuestas). Prototipos estáticos sobre el contenido real del seed.
async function fresh(page: Page, hash = '#/') {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto(`/${hash}`);
}

test('muestra las tres propuestas con el mismo contenido real y sin pedidos externos', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => { if (!r.url().startsWith('http://127.0.0.1:4173')) external.push(r.url()); });
  await fresh(page, '#/propuestas');
  await expect(page.getByRole('heading', { level: 1, name: 'Propuestas visuales · DentalOS' })).toBeVisible();
  await expect(page.getByRole('note').first()).toContainText('Demo');
  await expect(page.getByText('Ninguna está aprobada.')).toBeVisible();

  for (const [letter, name] of [['A', 'Editorial clínico cálido'], ['B', 'Soft glass sobrio'], ['C', 'Minimalismo tecnológico humano']]) {
    await page.getByRole('button', { name: `${letter} · ${name}` }).click();
    await expect(page.getByRole('heading', { level: 2, name: `${letter} · ${name}` })).toBeVisible();
    const frames = page.locator(`.pp-frame[data-prop="${letter.toLowerCase()}"]`);
    // Inicio, agenda, reserva y WhatsApp + tres muestras (carga, movimiento, familia) + tipografía.
    await expect(frames).toHaveCount(8);
    // Mismo contenido: el turno de Martina, la agenda de hoy y los horarios de primera consulta.
    await expect(frames.first()).toContainText('Control de ortodoncia');
    await expect(frames.nth(1)).toContainText('Hoy · lunes 19 de octubre');
    await expect(frames.nth(1)).toContainText('Pendiente de confirmación');
    await expect(frames.nth(2)).toContainText('Primera consulta · 45 min');
    await expect(frames.nth(3)).toContainText('A-0012 pasa al martes 20/10 a las 11:00 (versión 2)');
    // Cada pantalla conserva el indicador compacto de demo.
    for (let i = 0; i < 3; i++) await expect(frames.nth(i).locator('.pp-demo, .pp-sim').first()).toBeVisible();
    // La tabla de contraste no tiene pares por debajo del mínimo.
    await expect(page.locator('.pv-ratios .pv-bad')).toHaveCount(0);
  }
  expect(external).toEqual([]);
});

test('claro/oscuro y comparar la misma pantalla quedan en la URL', async ({ page }) => {
  await fresh(page, '#/propuestas?v=una&p=a&m=claro');
  const bg = () => page.locator('.pp-frame-desk').first().evaluate((e) => getComputedStyle(e).backgroundColor);
  const light = await bg();
  await page.getByRole('button', { name: 'Oscuro' }).click();
  await expect(page).toHaveURL(/m=oscuro/);
  await expect(page.getByRole('button', { name: 'Oscuro' })).toHaveAttribute('aria-pressed', 'true');
  expect(await bg()).not.toBe(light);

  await page.getByRole('button', { name: 'Comparar las tres' }).click();
  await page.getByRole('button', { name: 'Reservar en el teléfono' }).click();
  await expect(page).toHaveURL(/v=comparar.*s=reserva|s=reserva.*v=comparar/);
  const frames = page.locator('.pv-cmp-grid .pp-frame-phone');
  await expect(frames).toHaveCount(3);
  await expect(frames.nth(0)).toHaveAttribute('data-prop', 'a');
  await expect(frames.nth(2)).toHaveAttribute('data-prop', 'c');

  // Recargar conserva la vista elegida.
  await page.reload();
  await expect(page.locator('.pv-cmp-grid .pp-frame-phone')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Reservar en el teléfono' })).toHaveAttribute('aria-pressed', 'true');
});

test('a 390 px la página no se desborda y con movimiento reducido no hay animaciones', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const hash of ['#/propuestas?v=una&p=b&m=claro', '#/propuestas?v=comparar&s=whatsapp&m=oscuro', '#/propuestas?v=comparar&s=agenda&m=claro']) {
    await fresh(page, hash);
    await expect(page.locator('.pv-page')).toBeVisible();
    const [scroll, client] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(scroll, hash).toBeLessThanOrEqual(client);
  }
  const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length);
  expect(running).toBe(0);
});
