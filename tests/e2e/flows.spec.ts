import { expect, test, type Page } from '@playwright/test';

async function fresh(page: Page, hash = '#/') {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto(`/${hash}`);
}

test('S04/S02/S06: primera visita con validación, solicitud pendiente única y visible en recepción', async ({ page }) => {
  await fresh(page, '#/reservar');
  await page.getByLabel('Es mi primera vez').check();
  await page.locator('input[name="slot"]').first().check();
  await page.getByRole('button', { name: 'Enviar solicitud' }).click();
  await expect(page.locator('.error-summary')).toBeFocused();
  await expect(page.locator('.error-summary')).toContainText('Nombre');
  await page.locator('#firstName').fill('Paula');
  await page.locator('#lastName').fill('Muestra');
  await page.locator('#preferredChannel').selectOption('portal');
  const send = page.getByRole('button', { name: 'Enviar solicitud' });
  await send.dblclick();
  await expect(page.getByRole('heading', { name: 'Solicitud enviada' })).toBeVisible();
  await expect(page.locator('#main').getByText('Todavía no es un turno confirmado')).toBeVisible();
  await page.goto('/#/admin');
  await expect(page.locator('.card', { hasText: 'Por confirmar' }).getByText('Paula Muestra · P-013')).toHaveCount(1);
});

test('S17/S18: recepción confirma solicitud y registra check-in → atención → finalizado', async ({ page }) => {
  await fresh(page, '#/admin');
  const pending = page.locator('.card', { hasText: 'Por confirmar' });
  await pending.getByRole('button', { name: 'Confirmar' }).click();
  await expect(pending.getByText('Nada pendiente.')).toBeVisible();
  const row = page.locator('.list-item', { hasText: 'A-0003' });
  await row.getByRole('button', { name: 'Check-in' }).click();
  await row.getByRole('button', { name: 'En atención' }).click();
  await row.getByRole('button', { name: 'Finalizar' }).click();
  await expect(row).toContainText('Finalizado');
});

test('S43/S44: aceptar presupuesto no cobra; movimiento y reversión reconcilian sin duplicar', async ({ page }) => {
  await fresh(page, '#/admin/presupuestos');
  const net = page.locator('.kpi', { hasText: 'Caja ficticia neta' }).locator('.kpi-value');
  const before = await net.textContent();
  await page.getByRole('button', { name: /EST-003/ }).click();
  await page.getByRole('button', { name: 'Emitir' }).click();
  await page.getByRole('button', { name: 'Registrar aceptación (simulada)' }).click();
  await expect(page.locator('#main').getByText('Aceptado no es cobrado').first()).toBeVisible();
  await expect(net).toHaveText(before!);
  await page.getByLabel('Persona').last().selectOption('P-009');
  await page.getByLabel('Importe ficticio (ARS)').fill('1000');
  await page.getByRole('button', { name: 'Registrar movimiento simulado' }).click();
  await page.getByRole('button', { name: 'Registrar movimiento simulado' }).click();
  await expect(page.locator('#main').getByText(/Reintento detectado/)).toBeVisible();
  await page.locator('tr', { hasText: 'L-011' }).getByRole('button', { name: 'Revertir' }).click();
  await page.getByRole('button', { name: 'Registrar contrapartida' }).click();
  await expect(net).toHaveText(before!);
  await expect(page.getByRole('row', { name: /^L-012/ })).toContainText('Contrapartida de L-011');
});

test('S41: odontograma rechaza pieza incompatible y guarda/deshace', async ({ page }) => {
  await fresh(page, '#/admin/personas/P-004/odontograma');
  await page.getByLabel('O escribí la pieza (FDI)').fill('36');
  await page.getByRole('button', { name: 'Seleccionar' }).click();
  await expect(page.locator('#main').getByText(/no corresponde a la dentición temporal/)).toBeVisible();
  await page.getByRole('button', { name: /^Pieza 54/ }).click();
  await page.getByRole('button', { name: 'Guardar en la ficha' }).click();
  await expect(page.locator('#main').getByText('Registro guardado en la ficha.')).toBeVisible();
  await page.getByRole('button', { name: 'Deshacer último' }).click();
  await expect(page.locator('#main').getByText('Registro deshecho (queda en la auditoría).')).toBeVisible();
});

test('S45: dos ofertas compitiendo, un solo ganador', async ({ page }) => {
  await fresh(page, '#/admin/config');
  await page.locator('.list-item', { hasText: 'Dos ofertas compitiendo' }).getByRole('button', { name: 'Cargar' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cargar' }).click();
  await expect(page.locator('h1')).toHaveText('Lista de espera y recordatorios');
  await page.getByRole('button', { name: 'Simular aceptación simultánea' }).click();
  await expect(page.locator('#main').getByText(/P-012: obtuvo el cupo · P-008: Otra persona aceptó primero/)).toBeVisible();
});

test('S46: tarjeta educativa con reintento y sello que no suma dos veces', async ({ page }) => {
  await fresh(page, '#/aprender');
  const card = page.locator('.learn-card', { hasText: 'Cambiar un turno' });
  await card.getByRole('button', { name: 'Empezar' }).click();
  await card.getByRole('button', { name: /Se pierde/ }).click();
  await expect(card.getByText('Probá otra opción')).toBeVisible();
  await card.getByRole('button', { name: /Sigue reservado/ }).click();
  await card.getByRole('button', { name: 'Guardar sello' }).click();
  await expect(card.getByText('Sello guardado')).toBeVisible();
  await expect(page.locator('#main').getByText(/Tu colección: 1 de 3 sellos/)).toBeVisible();
});

test('S47: drawer con teclado — Escape cierra y devuelve el foco', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await fresh(page, '#/admin');
  const trigger = page.getByRole('button', { name: 'Alta manual' });
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Alta manual de turno' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('S15: dentro de 12 h el cambio deriva a recepción una sola vez', async ({ page }) => {
  await fresh(page, '#/mis-turnos');
  await page.locator('#acting').selectOption('P-011');
  await page.getByRole('button', { name: 'Pedir cambio' }).click();
  await page.getByRole('button', { name: 'Pedir ayuda a recepción' }).click();
  await expect(page.locator('#main').getByText(/Pedido enviado a recepción/)).toBeVisible();
  await page.getByRole('button', { name: 'Pedir ayuda a recepción' }).click();
  await expect(page.locator('#main').getByText(/Ya pediste ayuda/)).toBeVisible();
});

test('S33/S35/A04: llamada continúa la gestión y confirma el mismo turno sin duplicar', async ({ page }) => {
  await fresh(page, '#/whatsapp');
  const input = page.getByLabel('Escribí un mensaje');
  await input.fill('quiero reprogramar');
  await input.press('Enter');
  await page.getByRole('button', { name: /Control de ortodoncia · jue 22\/10/ }).click();
  await expect(page.locator('.bubble.asistente').last()).toContainText('Gestión R-006');
  await page.goto('/#/llamada');
  await page.locator('#call-req').selectOption('R-006');
  await page.getByRole('button', { name: 'Probar llamada simulada' }).click();
  await page.getByRole('button', { name: 'Cambiar mi control o turno' }).click();
  await page.getByRole('button', { name: /Probar mar 20\/10 · 10:00/ }).click();
  await expect(page.locator('.call-line')).toContainText('Conservamos tu turno anterior');
  await page.getByRole('button', { name: 'mié 21/10 · 15:00' }).click();
  await page.getByRole('button', { name: 'Confirmar cambio' }).click();
  await expect(page.locator('.call-line')).toContainText('Cambio guardado en esta demo');
  await page.getByRole('button', { name: 'Terminar llamada' }).click();
  await page.goto('/#/mis-turnos');
  await expect(page.locator('.list-item', { hasText: 'A-0012' })).toContainText('miércoles 21 de octubre, 15:00 h');
  await expect(page.locator('.list-item', { hasText: 'A-0012' })).toContainText('versión 2');
  await page.goto('/#/admin/bandeja');
  await page.getByRole('tab', { name: /Resueltas/ }).click();
  await expect(page.locator('#main').getByText('R-006 · reprogramacion')).toBeVisible();
});

test('S23: el borrador de reserva se conserva al navegar y volver', async ({ page }) => {
  await fresh(page, '#/reservar');
  await page.getByLabel('Es mi primera vez').check();
  await page.locator('#firstName').fill('Borrador');
  await page.goto('/#/aprender');
  await page.goBack();
  await expect(page.locator('#firstName')).toHaveValue('Borrador');
});
