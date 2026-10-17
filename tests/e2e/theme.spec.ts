import { expect, test, type Page } from './fixtures';

// Fase 1 del rediseño: modo oscuro con preferencia Sistema / Claro / Oscuro.
async function fresh(page: Page, hash = '#/') {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto(`/${hash}`);
}
const bg = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test('tema sistema: sigue prefers-color-scheme sin atributo en el documento', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await fresh(page);
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBeUndefined();
  const light = await bg(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  const dark = await bg(page);
  expect(dark).not.toBe(light);
  expect(dark).toBe('rgb(14, 22, 21)');
});

test('elegir “Oscuro” se aplica, se recuerda al recargar y no parpadea al cargar', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await fresh(page);
  await page.getByRole('button', { name: 'Tema: Sistema' }).click();
  const menu = page.getByRole('dialog', { name: 'Elegir tema' });
  await expect(menu).toBeVisible();
  await menu.getByRole('button', { name: /Oscuro/ }).click();
  await expect(menu).toBeHidden();
  await expect(page.getByRole('button', { name: 'Tema: Oscuro' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  expect(await bg(page)).toBe('rgb(14, 22, 21)');

  // Al recargar, el script de inicio aplica el tema antes de que monte la app (sin destello claro).
  await page.reload({ waitUntil: 'commit' });
  await page.waitForFunction(() => document.readyState !== 'loading');
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');

  // Volver a “Sistema” quita el atributo.
  await page.getByRole('button', { name: 'Tema: Oscuro' }).click();
  await page.getByRole('dialog', { name: 'Elegir tema' }).getByRole('button', { name: /Sistema/ }).click();
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBeUndefined();
});

test('modo oscuro en el panel: barra lateral, tarjetas y botón primario con contraste propio', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await fresh(page, '#/admin');
  const btn = page.getByRole('button', { name: 'Alta manual' });
  const [fg, back] = await btn.evaluate((el) => [getComputedStyle(el).color, getComputedStyle(el).backgroundColor]);
  // Dirección A en oscuro: relleno teal claro con texto oscuro.
  expect(fg).toBe('rgb(10, 21, 19)');
  expect(back).toBe('rgb(107, 191, 177)');
});
