import { expect, test, type Page } from './fixtures';

// Lote 6: campañas administrativas simuladas, economía con ND, asistentes deterministas y streaming interrumpible.
async function fresh(page: Page, hash = '#/admin/campanas') {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto(`/${hash}`);
}
function guard(page: Page) {
  const errors: string[] = []; const external: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('request', (r) => { if (!r.url().startsWith('http://127.0.0.1:4173/') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) external.push(r.url()); });
  return { errors, external };
}
const detail = (page: Page) => page.locator('.cmp-detail');
const notice = (page: Page) => page.locator('#main .notice').first();

test('S83/S88: ND deja el borrador; al cargar el dato se revisa, aprueba, activa (simulado), pausa y reanuda', async ({ page }) => {
  const g = guard(page);
  await fresh(page);
  await expect(detail(page)).toContainText('CMP-003 · Presupuestos sin respuesta');
  await expect(detail(page).locator('.cmp-eco')).toContainText('ND');
  await page.getByRole('button', { name: 'Revisar vista previa' }).click();
  await expect(notice(page)).toContainText('Faltan datos (ND): Costo fijo de la campaña');
  await expect(detail(page).locator('.badge').first()).toHaveText('Borrador');

  await page.getByLabel('Costo fijo de la campaña').fill('1000');
  await page.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(detail(page).locator('.cmp-eco')).toContainText('$ 1.300,00'); // fijo $1.000 + 1 llamada × $300
  await page.getByRole('button', { name: 'Revisar vista previa' }).click();
  await expect(notice(page)).toContainText('Vista previa revisada: 1 contacto(s)');
  await expect(detail(page).locator('.cmp-sample')).toContainText('presupuesto administrativo pendiente de respuesta');
  await expect(detail(page).locator('.cmp-sample')).not.toContainText('$');
  await page.getByRole('button', { name: 'Aprobar (dirección)' }).click();
  await page.getByRole('button', { name: 'Activar (simulado)' }).click();
  const dlg = page.getByRole('alertdialog', { name: '¿Activar CMP-003 (simulado)?' });
  await expect(dlg).toContainText('No se envía nada real');
  await dlg.getByRole('button', { name: 'Activar (simulado)' }).click();
  await expect(notice(page)).toContainText('Campaña activa (simulada): 1 mensaje(s)');
  await expect(detail(page).locator('[data-kind="simulado"]')).toContainText('Mensajes registrados: 1');
  await expect(detail(page).locator('[data-kind="observado"]')).toContainText('Reservar no es atender ni cobrar');
  await expect(detail(page).locator('[data-kind="proyectado"]')).toContainText('supuesto');
  await page.getByRole('button', { name: 'Pausar' }).click();
  await expect(detail(page).locator('.badge').first()).toHaveText('En pausa');
  await page.getByRole('button', { name: 'Reanudar' }).click();
  await expect(detail(page).locator('.badge').first()).toHaveText('Activa');
  // La llamada de recepción quedó como tarea, no como llamada automática.
  await page.goto('/#/admin/tareas');
  await expect(page.locator('#main')).toContainText('Llamar a P-006 por la campaña CMP-003');
  expect(g.errors).toEqual([]);
  expect(g.external).toEqual([]);
});

test('S82: audiencia vacía: la consulta sin identificar queda excluida y no se puede revisar', async ({ page }) => {
  await fresh(page);
  await page.locator('.seg-card', { hasText: 'Consultas sin turno' }).getByRole('button', { name: 'Crear borrador' }).click();
  await expect(detail(page)).toContainText('Consultas sin turno');
  await detail(page).getByText('Ver excluidos (1)').click();
  await expect(detail(page).locator('.cmp-excluded')).toContainText('Contacto sin identificar por ID');
  await page.getByLabel('Costo fijo de la campaña').fill('0');
  await page.getByRole('button', { name: 'Guardar borrador' }).click();
  await page.getByRole('button', { name: 'Revisar vista previa' }).click();
  await expect(notice(page)).toContainText('Nadie queda en la audiencia');
});

test('S80/S81: aviso masivo: baja, exclusión y frecuencia excluidos; los menores van a su responsable sin duplicar', async ({ page }) => {
  await fresh(page);
  await page.getByRole('button', { name: 'Nuevo aviso informativo' }).click();
  const aud = detail(page).locator('section[aria-labelledby="aud-title"]');
  await expect(aud).toContainText('6 contacto(s) elegible(s) · 3 excluido(s) · 3 unificado(s) por duplicado');
  await detail(page).getByText('Ver excluidos (3)').click();
  for (const t of ['Pidió la baja de campañas', 'Exclusión administrativa', 'Límite de frecuencia alcanzado']) await expect(detail(page).locator('.cmp-excluded')).toContainText(t);
  await expect(aud.locator('tr', { hasText: 'Ramiro Quiroga' })).toContainText('Diego Funes');
  // Dar de baja a Martina (P-001) la saca de la audiencia al instante.
  await page.getByLabel('Baja de campañas de Martina Sosa').first().check();
  await expect(aud).toContainText('5 contacto(s) elegible(s) · 4 excluido(s)');
});

test('S92–S94: asistente de dirección: responde del store, se puede detener y crea un borrador sin activarlo', async ({ page }) => {
  await fresh(page);
  const asst = page.locator('.assistant');
  await asst.getByRole('button', { name: 'Controles indicados pendientes' }).click();
  await expect(asst.locator('.asst-text')).toContainText('1 control(es) indicado(s) sin turno');
  await expect(asst.locator('.asst-text')).toContainText('Se coordina con Ramiro Quiroga (P-006), su responsable');
  await asst.getByRole('button', { name: 'Crear borrador (no se activa)' }).click();
  await expect(detail(page)).toContainText('CMP-004 · Controles ya indicados pendientes');
  await expect(detail(page).locator('.badge').first()).toHaveText('Borrador');

  // Pregunta libre sobre la campaña elegida: pide los faltantes y lleva al campo.
  await page.locator('#asst-q').fill('¿qué datos faltan?');
  await asst.getByRole('button', { name: 'Preguntar' }).click();
  await expect(asst.locator('.asst-text')).toContainText('CMP-004: faltan 5 dato(s)');
  await asst.getByRole('button', { name: 'Precio de lista por atención' }).click();
  await expect(page.getByLabel('Precio de lista por atención')).toBeFocused();

  // Streaming interrumpible: detener deja la respuesta parcial y se puede ver completa.
  await asst.getByRole('button', { name: 'Costo de la campaña' }).click();
  await asst.getByRole('button', { name: 'Detener' }).click();
  await expect(asst).toContainText('Respuesta detenida.');
  await asst.getByRole('button', { name: 'Ver completa' }).click();
  await expect(asst.locator('.asst-text')).toContainText('Costo de la campaña: ND');
  await expect(page.locator('.cmp-item', { hasText: 'CMP-004' }).locator('.badge')).toHaveText('Borrador');
});

test('calendario semanal, mensual, bimestral y estacional de las campañas', async ({ page }) => {
  await fresh(page);
  const cal = page.locator('section[aria-labelledby="cal-title"]');
  await expect(cal.locator('.cal-month')).toHaveCount(1);
  await expect(cal.locator('.cal-list')).toContainText('CMP-002');
  await cal.getByRole('button', { name: 'Bimestre' }).click();
  await expect(cal.locator('.cal-month')).toHaveCount(2);
  await cal.getByRole('button', { name: 'Temporada' }).click();
  await expect(cal.locator('.cal-month')).toHaveCount(3);
  await cal.getByRole('button', { name: 'Semana' }).click();
  await expect(cal.locator('.cal-week .cal-day')).toHaveCount(7);
  await expect(cal.locator('.cal-day.is-today')).toHaveCount(1);
});

test('S95/S96: WhatsApp: mi próximo turno y mi seguimiento con respuesta breve; lo clínico se deriva', async ({ page }) => {
  await fresh(page, '#/whatsapp');
  await page.locator('#wa-text').fill('hola');
  await page.getByRole('button', { name: 'Enviar' }).click();
  await page.getByRole('button', { name: 'Mi próximo turno' }).click();
  await expect(page.locator('.bubble.asistente').last()).toContainText('A-0012');
  await expect(page.locator('.bubble.asistente').last().locator('.bubble-text')).toContainText('A-0012'); // terminó de aparecer
  await page.getByRole('button', { name: 'Volver al menú' }).click();
  await page.getByRole('button', { name: 'Mi seguimiento' }).click();
  await expect(page.locator('.bubble.asistente').last()).toContainText('El control IC-001 ya tiene turno');
  await page.locator('#wa-text').fill('me duele mucho, ¿qué tomo?');
  await page.getByRole('button', { name: 'Enviar' }).click();
  const last = page.locator('.bubble.asistente').last();
  await expect(last).toContainText(/recepci/i);
  await expect(last).not.toContainText(/ibuprofeno|grave|leve/i);
});
