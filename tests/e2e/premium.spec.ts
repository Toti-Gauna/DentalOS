import { expect, test, type Page } from './fixtures';

// Fase 2b: arte propio (dientes, ortodoncia, personajes), Brisa Chicos y sonidos opt-in.
async function fresh(page: Page, hash = '#/') {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto(`/${hash}`);
}

/** AudioContext falso: cuenta contextos creados y no emite sonido. */
async function fakeAudio(page: Page) {
  await page.addInitScript(() => {
    const stats = { contexts: 0 };
    (window as unknown as { __audio: typeof stats }).__audio = stats;
    class Param { value = 0; setValueAtTime() { return this; } linearRampToValueAtTime() { return this; } }
    class Node { connect(n: unknown) { return n; } disconnect() {} }
    class Osc extends Node { type = 'sine'; frequency = new Param(); onended = null; start() {} stop() {} }
    class Gain extends Node { gain = new Param(); }
    class Ctx { state = 'running'; currentTime = 0; destination = new Node(); constructor() { stats.contexts++; } createOscillator() { return new Osc(); } createGain() { return new Gain(); } resume() { return Promise.resolve(); } close() { this.state = 'closed'; return Promise.resolve(); } }
    (window as unknown as { AudioContext: unknown }).AudioContext = Ctx;
  });
}
const contexts = (page: Page) => page.evaluate(() => (window as unknown as { __audio: { contexts: number } }).__audio.contexts);
const played = (page: Page) => page.evaluate(() => (window as unknown as { __sound: { played: string[] } }).__sound.played);

test('inicio premium: arte por motivo, equipo ilustrado y acceso a Brisa Chicos', async ({ page }) => {
  await fresh(page);
  await expect(page.locator('#main .service-art')).toHaveCount(6);
  await expect(page.locator('#main .team-card')).toHaveCount(4);
  await expect(page.locator('#main').getByText('Los avatares son ilustraciones')).toBeVisible();
  await page.getByRole('button', { name: 'Ir a Brisa Chicos' }).click();
  await expect(page.locator('h1')).toHaveText('Sonrisas valientes');
  await expect(page.locator('h1')).toBeFocused();
  await expect(page.getByRole('navigation', { name: 'Portal de pacientes' }).getByRole('link', { name: 'Chicos' })).toHaveAttribute('aria-current', 'page');
});

test('Brisa Chicos: los cuatro Brisitos están juntos, saludan a la vez y el álbum persiste y se vacía', async ({ page }) => {
  await fresh(page, '#/chicos');
  const stage = page.getByRole('group', { name: 'Los Brisitos' });
  for (const name of ['Mora', 'Coco', 'Ivo', 'Lía']) await expect(stage.getByRole('button', { name: `Conocer a ${name}` })).toBeVisible();
  const album = page.locator('.album');
  await expect(album.locator('.album-slot.is-earned')).toHaveCount(0);

  await stage.getByRole('button', { name: '¡Hola, Brisitos!' }).click();
  await expect(stage.locator('.hello-bubble')).toHaveCount(4);
  await expect(stage.locator('.brisitos-bubble')).toHaveText('¡Los cuatro te saludan!');
  await expect(album.locator('.album-slot.is-earned')).toHaveCount(1);
  await expect(page.locator('.sr-only[aria-atomic="true"]')).toContainText('Nuevo sticker: Equipo completo');

  // Tocar a cada uno muestra su globo; al conocer a los cuatro llega otro sticker (sin duplicar al repetir).
  await stage.getByRole('button', { name: 'Conocer a Coco' }).click();
  await expect(stage.getByRole('button', { name: 'Conocer a Coco' })).toHaveAttribute('aria-pressed', 'true');
  await expect(stage.locator('.brisitos-bubble')).toContainText('¡Soy Coco!');
  for (const name of ['Mora', 'Ivo', 'Lía']) await stage.getByRole('button', { name: `Conocer a ${name}` }).click();
  await expect(stage.getByText('Conociste a 4 de 4')).toBeVisible();
  await expect(album.locator('.album-slot.is-new')).toContainText('Amigos de verdad');
  await stage.getByRole('button', { name: 'Conocer a Mora' }).click();
  await expect(album.locator('.album-slot.is-earned')).toHaveCount(2);

  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Terminar el cuento' }).click();
  await expect(album.locator('.album-slot.is-earned')).toHaveCount(3);

  await page.reload();
  await expect(page.locator('.album .album-slot.is-earned')).toHaveCount(3);
  await page.getByRole('button', { name: 'Vaciar álbum' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Vaciar', exact: true }).click();
  await expect(page.locator('.album .album-slot.is-earned')).toHaveCount(0);
  await expect(page.getByText('Conociste a 0 de 4')).toBeVisible();
});

// `clock.install` deja correr el tiempo en vivo además de los saltos de `runFor`: un juego de 30 s puede terminar entre un
// `count()` y un `click()` (falla intermitente medida en 1 de 5 corridas). Pausar el reloj lo vuelve determinista.
async function pausedClock(page: Page, hash: string) {
  await page.clock.install({ time: new Date('2026-10-19T12:00:00Z') });
  await fresh(page, hash);
  await page.clock.pauseAt(new Date('2026-10-19T12:05:00Z'));
}

test('juego “Cazá los bichitos”: aparecen bichitos, cepillarlos suma, a los 30 s da estrellas y sticker (reloj controlado)', async ({ page }) => {
  await pausedClock(page, '#/chicos');
  await page.getByRole('button', { name: 'Jugar a limpiar la sonrisa' }).click();
  await expect(page.getByRole('heading', { name: 'Cazá los bichitos' })).toBeFocused();
  const board = page.getByRole('group', { name: /Boca del juego/ });
  await expect(board.getByRole('button')).toHaveCount(12);
  await expect(board.getByRole('button').first()).toBeDisabled();

  const start = page.getByRole('button', { name: 'Empezar a jugar' });
  await start.click();
  await expect(page.getByRole('button', { name: 'Terminar' })).toBeFocused(); // el foco no se pierde al cambiar el botón
  const dirty = board.getByRole('button', { name: /tiene un bichito/ });
  await expect(dirty).toHaveCount(1);
  // Un diente limpio no suma; uno con bichito sí.
  await board.getByRole('button', { name: /^Diente \d de (arriba|abajo)$/ }).first().click();
  await expect(page.locator('.game-hud dd').first()).toHaveText('0');
  await dirty.first().click();
  await expect(page.locator('.game-hud dd').first()).toHaveText('1');

  // Teclado: Tab entra al tablero, Enter cepilla.
  await page.clock.runFor(1_000);
  await dirty.first().focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.game-hud dd').first()).toHaveText('2');

  // Un bichito vive 4 s: cepillar cada 2 s lo alcanza siempre y la partida entera cuesta 15 vueltas, no 60.
  for (let t = 0; t < 15; t++) {
    while (await dirty.count()) await dirty.first().click();
    await page.clock.runFor(2_000);
  }
  await expect(page.getByText('¡Sonrisa brillante!')).toBeVisible();
  await expect(page.getByLabel('3 de 3 estrellas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Jugar otra vez' })).toBeVisible();
  const album = page.locator('.album');
  for (const label of ['Cazabichitos', 'Sonrisa brillante']) await expect(album.locator('.album-slot.is-earned', { hasText: label })).toHaveCount(1);
  await expect(page.locator('.game-hud div', { hasText: 'Récord' }).locator('dd')).not.toHaveText('0');
});

test('juego sin apuro: no hay reloj ni escapes y se termina al limpiar 12', async ({ page }) => {
  await pausedClock(page, '#/chicos');
  await page.getByLabel('Ritmo').selectOption('tranquilo');
  await page.getByRole('button', { name: 'Empezar a jugar' }).click();
  await page.clock.runFor(60_000);
  const board = page.getByRole('group', { name: /Boca del juego/ });
  const dirty = board.getByRole('button', { name: /tiene un bichito/ });
  await expect(dirty).toHaveCount(3);
  for (let i = 0; i < 20 && (await page.getByRole('button', { name: 'Terminar' }).count()); i++) {
    while (await dirty.count()) await dirty.first().click();
    await page.clock.runFor(2_000);
  }
  await expect(page.getByText('¡Sonrisa brillante!')).toBeVisible();
  await expect(page.locator('.game-hud div', { hasText: 'Meta' }).locator('dd')).toHaveText('12 de 12');
});

test('Brisa Chicos: los accesos del encabezado llevan al reloj y al cuento sin salir de la página', async ({ page }) => {
  await fresh(page, '#/chicos');
  await page.getByRole('button', { name: 'Cepillarme con el reloj' }).click();
  await expect(page).toHaveURL(/#\/chicos$/);
  await expect(page.getByRole('heading', { name: 'Dos minutos con Coco' })).toBeFocused();
  await page.getByRole('button', { name: 'Leer el cuento' }).click();
  await expect(page).toHaveURL(/#\/chicos$/);
  await expect(page.locator('#story-title')).toBeFocused();
  await expect(page.locator('h1')).toHaveText('Sonrisas valientes');
});

test('reloj de cepillado: avanza por zonas, termina y da sticker (reloj controlado)', async ({ page }) => {
  await pausedClock(page, '#/chicos');
  await page.getByLabel('Duración').selectOption('20');
  await page.getByRole('button', { name: 'Empezar', exact: true }).click();
  await expect(page.locator('.zone-now')).toHaveText('Ahora: Arriba a la derecha');
  await page.clock.runFor(5_000);
  await expect(page.locator('.zone-now')).toHaveText('Ahora: Arriba a la izquierda');
  await page.getByRole('button', { name: 'Pausar' }).click();
  await page.clock.runFor(10_000);
  await expect(page.getByRole('img', { name: 'Quedan 15 segundos' })).toBeVisible();
  await page.getByRole('button', { name: 'Seguir' }).click();
  for (let i = 0; i < 16; i++) await page.clock.runFor(1_000);
  await expect(page.locator('.zone-now')).toHaveText('¡Listo! Ganaste un sticker.');
  await expect(page.getByText('Cepillados completos en este dispositivo: 1.')).toBeVisible();
  await expect(page.locator('.album-slot.is-earned', { hasText: 'Primer cepillado' })).toHaveCount(1);
});

test('sonidos: apagados por defecto; el AudioContext nace solo con el gesto y se recuerda la preferencia', async ({ page }) => {
  await fakeAudio(page);
  await fresh(page, '#/chicos');
  await page.getByRole('button', { name: 'Conocer a Mora' }).click();
  expect(await contexts(page)).toBe(0);
  expect(await played(page)).toEqual([]);

  await page.getByRole('button', { name: 'Controles de la demo' }).click();
  const toggle = page.getByRole('button', { name: 'Sonidos: no' });
  await toggle.click();
  await expect(page.getByRole('button', { name: 'Sonidos: sí' })).toHaveAttribute('aria-pressed', 'true');
  expect(await contexts(page)).toBe(1);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '¡Hola, Brisitos!' }).click();
  expect(await played(page)).toEqual(expect.arrayContaining(['toggle', 'pop', 'stamp']));

  // Al recargar la preferencia sigue activa, pero no hay audio hasta el próximo gesto (sin autoplay).
  await page.reload();
  await expect(page.locator('h1')).toHaveText('Sonrisas valientes');
  expect(await page.evaluate(() => (window as unknown as { __sound: { enabled: boolean } }).__sound.enabled)).toBe(true);
  expect(await contexts(page)).toBe(0);
  await page.getByRole('button', { name: 'Conocer a Ivo' }).click();
  expect(await contexts(page)).toBe(1);

  await page.getByRole('button', { name: 'Controles de la demo' }).click();
  await page.getByRole('button', { name: 'Sonidos: sí' }).click();
  await expect(page.getByRole('button', { name: 'Sonidos: no' })).toBeVisible();
  await page.keyboard.press('Escape');
  const before = (await played(page)).length;
  await page.getByRole('button', { name: 'Conocer a Lía' }).click();
  expect((await played(page)).length).toBe(before);
});

test('odontograma ilustrado: oro, implante y ausente; un registro nuevo cambia la ilustración', async ({ page }) => {
  await fresh(page, '#/admin/personas/P-008/odontograma');
  await expect(page.getByRole('button', { name: /^Pieza 16,/ })).toHaveAttribute('data-art', 'corona_oro');
  await expect(page.getByRole('button', { name: /^Pieza 25,/ })).toHaveAttribute('data-art', 'implante');
  await expect(page.getByRole('button', { name: /^Pieza 38,/ })).toHaveAttribute('data-art', 'ausente');
  await expect(page.getByRole('navigation', { name: 'Panel de la clínica' }).getByRole('link', { name: /Odontograma/ })).toHaveAttribute('aria-current', 'page');
  await page.getByText('Catálogo de registros ilustrados').click();
  await expect(page.locator('.tooth-catalog .catalog-item')).toHaveCount(13);

  await page.getByRole('button', { name: /^Pieza 26$/ }).click();
  await page.getByLabel('Pieza completa').check();
  await page.getByLabel('Registro', { exact: true }).selectOption('Implante');
  await page.getByLabel('Estado', { exact: true }).selectOption('realizado');
  await page.getByRole('button', { name: 'Guardar en la ficha' }).click();
  await expect(page.getByRole('button', { name: /^Pieza 26,/ })).toHaveAttribute('data-art', 'implante');
});

test('ortodoncia: aparatología ilustrada; cambiarla queda en el timeline', async ({ page }) => {
  await fresh(page, '#/admin/ortodoncia');
  await expect(page.getByRole('img', { name: 'Ilustración: Brackets estéticos' })).toBeVisible();
  await page.getByLabel('Cambiar registro (profesional)').selectOption('alineadores');
  await expect(page.getByRole('img', { name: 'Ilustración: Alineadores transparentes' })).toBeVisible();
  await expect(page.locator('.timeline')).toContainText('aparatologia');
  await page.getByText('Catálogo de aparatología').click();
  await expect(page.locator('.appliance-catalog .catalog-item')).toHaveCount(5);
});
