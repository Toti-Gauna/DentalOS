import { expect, test, type Page } from './fixtures';

// Lote 4: galería de arte y mockups interactivos ampliables (mismo componente, mismo estado).
async function fresh(page: Page, hash = '#/') {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto(`/${hash}`);
}
const noFullscreen = (page: Page) => page.addInitScript(() => { Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false }); });
const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('dentalos.demo.v1') ?? '{}') as { state?: { messages?: unknown[] } });

test('S59/S60: galería de arte en claro y oscuro, sin IDs repetidos, sin errores ni red externa', async ({ page }) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', (r) => { if (!r.url().startsWith('http://127.0.0.1:4173')) external.push(r.url()); });
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await fresh(page, '#/galeria');
    await expect(page.locator('h1')).toHaveText('Galería del arte de la demo');
    await expect(page.locator('.gal-section')).toHaveCount(5);
    await expect(page.locator('.gallery .spot-art')).toHaveCount(11);
    await expect(page.getByText(/fidelidad anatómica está pendiente de revisión odontológica/)).toBeVisible();
    const dupes = await page.evaluate(() => {
      const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
      return ids.filter((id, i) => ids.indexOf(id) !== i);
    });
    expect(dupes).toEqual([]);
    await page.getByRole('button', { name: 'Ampliado ×2' }).click();
    await expect(page.locator('.gallery')).toHaveClass(/is-big/);
  }
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('S61: WhatsApp a pantalla completa conserva el chat y lo escrito; un envío ampliado se guarda una sola vez', async ({ page }) => {
  await fresh(page, '#/whatsapp');
  await page.locator('#wa-text').fill('Hola desde la vista normal');
  const before = (await page.locator('.bubble').count());
  const toggle = page.getByRole('button', { name: 'Ampliar / Pantalla completa' });
  await toggle.click();
  const surface = page.locator('.xsurface-chat');
  await expect(surface).toHaveClass(/is-fullscreen|is-expanded/);
  // Mismo componente: lo escrito y la conversación siguen ahí, sin reiniciar.
  await expect(page.locator('#wa-text')).toHaveValue('Hola desde la vista normal');
  await expect(page.locator('.bubble')).toHaveCount(before);
  await page.locator('#wa-text').fill('quiero cambiar mi turno');
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.locator('.bubble.paciente').last()).toContainText('quiero cambiar mi turno');
  const afterSend = await page.locator('.bubble').count();
  await page.getByRole('button', { name: 'Restaurar / Cerrar' }).click();
  await expect(surface).toHaveClass(/is-normal/);
  await expect(page.getByRole('button', { name: 'Ampliar / Pantalla completa' })).toBeFocused();
  await expect(page.locator('.bubble')).toHaveCount(afterSend);
  const msgs = (await stored(page)).state?.messages as { text: string }[];
  expect(msgs.filter((m) => m.text === 'quiero cambiar mi turno')).toHaveLength(1);
});

test('S62: sin Fullscreen API, modo ampliado en la página: diálogo, fondo inerte, Escape y Atrás cierran sin salir de la ruta', async ({ page }) => {
  await noFullscreen(page);
  await fresh(page, '#/whatsapp');
  await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'instant' }));
  await page.getByRole('button', { name: 'Ampliar / Pantalla completa' }).click();
  const dialog = page.getByRole('dialog', { name: /WhatsApp simulado/ });
  await expect(dialog).toBeVisible();
  // Posición de la página en el momento de ampliar (Playwright pudo desplazarla para hacer clic): debe volver a ella.
  const y = await page.evaluate(() => window.scrollY);
  expect(y).toBeGreaterThan(100);
  expect(await page.evaluate(() => !!document.fullscreenElement)).toBe(false);
  expect(await page.evaluate(() => !!document.querySelector('.site-header')!.closest('[inert]'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('.xsurface-chat')).toHaveClass(/is-normal/);
  await expect(page.getByRole('button', { name: 'Ampliar / Pantalla completa' })).toBeFocused();
  expect(Math.abs(await page.evaluate(() => window.scrollY) - y)).toBeLessThanOrEqual(2);
  expect(await page.evaluate(() => !!document.querySelector('.site-header')!.closest('[inert]'))).toBe(false);

  // Atrás cierra la vista ampliada y deja la página en la misma ruta.
  await page.getByRole('button', { name: 'Ampliar / Pantalla completa' }).click();
  await expect(dialog).toBeVisible();
  await page.goBack();
  await expect(page.locator('.xsurface-chat')).toHaveClass(/is-normal/);
  await expect(page).toHaveURL(/#\/whatsapp$/);
  await expect(page.locator('h1')).toHaveText('WhatsApp de la demo');
});

test('S62: cerrar con el botón no retrocede de más: el historial vuelve a la página anterior real', async ({ page }) => {
  await noFullscreen(page);
  await fresh(page, '#/aprender');
  await page.goto('/#/whatsapp');
  await page.getByRole('button', { name: 'Ampliar / Pantalla completa' }).click();
  await page.getByRole('button', { name: 'Restaurar / Cerrar' }).click();
  await expect(page).toHaveURL(/#\/whatsapp$/);
  await page.goBack();
  await expect(page).toHaveURL(/#\/aprender$/);
});

for (const [w, h] of [[390, 844], [844, 390]]) {
  test(`S63: a ${w}×${h} la superficie ampliada ocupa la ventana, sin velo oscuro, y el campo de texto queda a la vista`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await noFullscreen(page);
    await fresh(page, '#/whatsapp');
    await page.getByRole('button', { name: 'Ampliar / Pantalla completa' }).click();
    const box = await page.locator('.xsurface-chat').boundingBox();
    expect(box!.x).toBe(0); expect(box!.y).toBe(0);
    expect(Math.round(box!.width)).toBe(w); expect(Math.round(box!.height)).toBe(h);
    const [surfaceBg, bodyBg] = await page.evaluate(() => [getComputedStyle(document.querySelector('.xsurface-chat')!).backgroundColor, getComputedStyle(document.body).backgroundColor]);
    expect(surfaceBg).toBe(bodyBg); // el fondo es el papel de la app, no un velo
    const input = await page.locator('#wa-text').boundingBox();
    expect(input!.y + input!.height).toBeLessThanOrEqual(h);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
}

test('S64: la llamada ampliada sigue el mismo paso y la misma transcripción; responder ampliado no duplica líneas', async ({ page }) => {
  await noFullscreen(page);
  await fresh(page, '#/llamada');
  await page.getByRole('button', { name: 'Probar llamada simulada' }).click();
  await page.getByRole('button', { name: 'Cambiar mi control o turno' }).click();
  await expect(page.locator('.call-options')).toBeVisible();
  const lines = await page.locator('.transcript p').count();
  const step = await page.locator('.call-line').innerText();
  await page.getByRole('button', { name: 'Ampliar / Pantalla completa' }).click();
  await expect(page.getByRole('dialog', { name: /Llamada simulada/ })).toBeVisible();
  await expect(page.locator('.transcript p')).toHaveCount(lines);
  await expect(page.locator('.call-line')).toHaveText(step);
  await page.locator('.call-options .btn').first().click();
  await expect(page.locator('.transcript p')).toHaveCount(lines + 2);
  await page.getByRole('button', { name: 'Restaurar / Cerrar' }).click();
  await expect(page.locator('.transcript p')).toHaveCount(lines + 2);
  await expect(page.getByRole('button', { name: 'Ampliar / Pantalla completa' })).toBeFocused();
});
