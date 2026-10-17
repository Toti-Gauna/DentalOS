import { expect, test, type Page } from './fixtures';
import { FACES, shuffledDeck } from '../../src/pages/public/kidsMemory';

// Lote 5: recorridos entre vistas, presupuestos en el portal con la regla del menor y Brisa Chicos (pausa + memoria).
async function fresh(page: Page, hash = '#/') {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto(`/${hash}`);
}
async function pausedClock(page: Page, hash: string) {
  await page.clock.install({ time: new Date('2026-10-19T12:00:00Z') });
  await fresh(page, hash);
  await page.clock.pauseAt(new Date('2026-10-19T12:05:00Z'));
}
const dock = (page: Page) => page.getByRole('dialog', { name: 'Controles de la demo' });
async function journeyStep(page: Page, journey: string, step: number) {
  await page.getByRole('button', { name: /Controles de la demo/ }).click();
  const d = dock(page);
  const det = d.locator('details.journey', { hasText: journey });
  if (!(await det.evaluate((el) => (el as HTMLDetailsElement).open))) await det.locator('summary').click();
  await det.locator('.journey-step').nth(step - 1).click();
}

test('S67–S69: el recorrido del presupuesto de un menor cruza recepción y portal; Carla acepta y no se cobra nada', async ({ page }) => {
  await fresh(page, '#/');
  await journeyStep(page, 'Presupuesto de un menor', 1);
  await expect(page).toHaveURL(/#\/admin\/presupuestos$/);
  const net = page.locator('.kpi', { hasText: 'Caja ficticia neta' }).locator('.kpi-value');
  const before = await net.textContent();
  await page.getByRole('button', { name: /EST-004/ }).click();
  // Recepción: el presupuesto es de un menor; solo puede decidir su adulto responsable.
  const decider = page.getByLabel('Decide (adulto responsable)');
  await expect(decider).toBeVisible();
  await expect(decider.locator('option')).toHaveText(['Carla Benítez · P-003']);

  await journeyStep(page, 'Presupuesto de un menor', 2);
  await expect(page).toHaveURL(/#\/mis-turnos$/);
  await expect(page.locator('#acting')).toHaveValue('P-003');
  const card = page.locator('.estimate-card', { hasText: 'EST-004' });
  await expect(card).toContainText('para Tomás');
  await expect(card).toContainText('Selladores en molares');
  // También desde el chip de Tomás decide la persona adulta que usa el portal, no el menor.
  await page.getByRole('button', { name: 'Tomás · P-004' }).click();
  await expect(card.getByRole('button', { name: 'Aceptar presupuesto' })).toBeVisible();
  await card.getByRole('button', { name: 'Aceptar presupuesto' }).click();
  const confirm = page.getByRole('alertdialog', { name: '¿Aceptar el presupuesto EST-004?' });
  await expect(confirm).toContainText('No es un pago');
  await confirm.getByRole('button', { name: 'Aceptar', exact: true }).click();
  await expect(card).toContainText('Saldo y pagos simulados (aparte de la aceptación)');
  await expect(card).toContainText('Aceptó: Carla Benítez');
  await expect(card.getByRole('button', { name: 'Aceptar presupuesto' })).toHaveCount(0);

  await journeyStep(page, 'Presupuesto de un menor', 3);
  await page.getByRole('button', { name: /EST-004/ }).click();
  await expect(page.locator('#main').getByText(/Decidió: Carla Benítez/)).toBeVisible();
  await expect(page.locator('#main').getByText('Aceptado no es cobrado').first()).toBeVisible();
  await expect(net).toHaveText(before!);
});

test('S70: cada recorrido arranca en su vista y ruta; los pasos funcionan con teclado', async ({ page }) => {
  await fresh(page, '#/');
  await page.getByRole('button', { name: /Controles de la demo/ }).click();
  const d = dock(page);
  await expect(d.locator('details.journey')).toHaveCount(4);
  const summary = d.locator('details.journey', { hasText: 'Un mensaje que llega a recepción' }).locator('summary');
  await summary.focus();
  await page.keyboard.press('Enter');
  await d.locator('[data-journey="mensaje-2"]').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/admin\/bandeja$/);
  await expect(page.getByRole('button', { name: /vista Recepción/ })).toBeVisible();
  await journeyStep(page, 'Brisa Chicos en familia', 2);
  await expect(page).toHaveURL(/#\/chicos$/);
  await expect(page.getByRole('heading', { name: 'Encontrá las parejas' })).toBeVisible();
});

test('S73: el juego de bichitos se pausa: el reloj no corre, el tablero no responde y “Seguir” retoma', async ({ page }) => {
  await pausedClock(page, '#/chicos');
  await page.getByRole('button', { name: 'Empezar a jugar' }).click();
  await page.clock.runFor(3_000);
  const time = page.locator('.game .game-hud div', { hasText: 'Tiempo' }).locator('dd');
  const t0 = await time.textContent();
  await page.getByRole('button', { name: 'Pausar' }).first().click();
  await expect(page.getByText('En pausa. Tocá “Seguir” cuando quieras.')).toBeVisible();
  await page.clock.runFor(10_000);
  await expect(time).toHaveText(t0!);
  await expect(page.getByRole('group', { name: /Boca del juego/ }).getByRole('button').first()).toBeDisabled();
  await page.getByRole('button', { name: 'Seguir' }).click();
  await page.clock.runFor(2_000);
  await expect(time).not.toHaveText(t0!);
  await page.getByRole('button', { name: 'Terminar' }).click();
  await expect(page.getByRole('button', { name: 'Jugar otra vez' })).toBeVisible();
});

test('S74–S76: memoria de los Brisitos: reglas, par distinto que se tapa, teclado, pausa, éxito, sticker y reintento', async ({ page }) => {
  await pausedClock(page, '#/chicos');
  await page.getByRole('button', { name: 'Jugar a la memoria' }).click();
  await expect(page.getByRole('heading', { name: 'Encontrá las parejas' })).toBeFocused();
  const grid = page.getByRole('group', { name: /Tablero de memoria/ });
  const cards = grid.getByRole('button');
  await expect(cards).toHaveCount(12);
  await expect(cards.first()).toBeDisabled();
  await expect(page.getByLabel('Con reloj o sin apuro')).toHaveValue('tranquilo');

  await page.getByRole('button', { name: 'Empezar memoria' }).click();
  await expect(cards.first()).toBeFocused();
  const hud = page.locator('.memory .game-hud dd');
  await expect(hud.nth(2)).toHaveText('libre');

  // Primera ronda guardada en este dispositivo = mazo 0 (determinista, sin azar real).
  const deck = shuffledDeck(0);
  const other = deck.findIndex((f) => f !== deck[0]);
  await cards.nth(0).click();
  await cards.nth(other).click();
  await expect(cards.nth(other)).not.toHaveAccessibleName(/boca abajo/);
  await expect(hud.nth(1)).toHaveText('1');
  await page.clock.runFor(1_200);
  await expect(cards.nth(0)).toHaveAccessibleName('Carta 1: boca abajo');
  await expect(cards.nth(other)).toHaveAccessibleName(`Carta ${other + 1}: boca abajo`);

  // Teclado: flechas recorren la grilla (4 columnas), Enter da vuelta.
  await cards.nth(0).focus();
  await page.keyboard.press('ArrowDown');
  await expect(cards.nth(4)).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(cards.nth(5)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(cards.nth(5)).not.toHaveAccessibleName(/boca abajo/);

  // Pausa: las cartas no responden hasta “Seguir”.
  await page.locator('.memory').getByRole('button', { name: 'Pausar' }).click();
  await expect(cards.nth(0)).toBeDisabled();
  await page.locator('.memory').getByRole('button', { name: 'Seguir' }).click();

  // La carta 5 quedó dada vuelta: primero su pareja, después el resto del mazo.
  await cards.nth(deck.findIndex((f, i) => f === deck[5] && i !== 5)).click();
  for (const face of FACES.filter((f) => f !== deck[5])) {
    for (const i of deck.flatMap((f, k) => (f === face ? [k] : []))) await cards.nth(i).click();
  }
  await expect(hud.first()).toHaveText('6 de 6');
  await expect(page.getByText(/¡Memoria de campeón!|¡Todas las parejas!/)).toBeVisible();
  await expect(page.locator('.album .album-slot.is-earned', { hasText: 'Buena memoria' })).toHaveCount(1);

  // Reintento con otra ronda y salida sin culpa.
  await page.getByRole('button', { name: 'Jugar otra vez' }).last().click();
  await expect(hud.first()).toHaveText('0 de 6');
  await page.getByRole('button', { name: 'Salir de la partida' }).click();
  await expect(page.getByText('¡Hasta la próxima!')).toBeVisible();
});

test('S75: memoria con reloj: termina a los 90 s sin perder lo ganado y el modo sin apuro queda disponible', async ({ page }) => {
  await pausedClock(page, '#/chicos');
  await page.getByLabel('Con reloj o sin apuro').selectOption('reloj');
  await page.getByRole('button', { name: 'Empezar memoria' }).click();
  await expect(page.getByLabel('Con reloj o sin apuro')).toBeDisabled();
  const hud = page.locator('.memory .game-hud dd');
  await expect(hud.nth(2)).toHaveText('90 s');
  await page.clock.runFor(91_000);
  await expect(page.getByText('¡Hasta la próxima!')).toBeVisible();
  await expect(page.getByLabel('Con reloj o sin apuro')).toBeEnabled();
});

test('S77: textos de Brisa Chicos sin ranking de salud, culpa, compras ni premios por tratamientos', async ({ page }) => {
  await fresh(page, '#/chicos');
  const text = (await page.locator('#main').innerText()).toLowerCase();
  for (const bad of ['comprá', 'compra ', 'tienda', 'monedas', 'premio por', 'descuento', 'ranking de', 'tu culpa', 'mal cepillado', 'diagnóstic']) expect(text).not.toContain(bad);
  await expect(page.getByText(/no miden ni evalúan el cepillado real ni la salud de la boca/)).toBeVisible();
  await expect(page.getByText(/no se canjean por nada\. No hay ranking ni rachas/)).toBeVisible();
  const how = (await page.locator('.album-slot .small').allInnerTexts()).join(' ').toLowerCase();
  for (const bad of ['turno', 'presupuesto', 'tratamiento', 'pago', 'consulta']) expect(how).not.toContain(bad);
});
