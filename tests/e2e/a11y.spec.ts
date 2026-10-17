import { expect, test, type Page } from './fixtures';

// L2.5 — revisión de accesibilidad y responsive sobre la UI renderizada (misma seed).
const ROUTES = ['#/', '#/reservar', '#/mis-turnos', '#/whatsapp', '#/llamada', '#/aprender', '#/sedes/L-CEN', '#/servicios/ST-PRIMERA', '#/chicos',
  '#/admin', '#/admin/bandeja', '#/admin/personas', '#/admin/personas/P-003', '#/admin/personas/P-008/odontograma', '#/admin/ortodoncia',
  '#/admin/presupuestos', '#/admin/campanas', '#/admin/espera', '#/admin/tareas', '#/admin/informes', '#/admin/config'];

async function fresh(page: Page, hash = '#/') {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto(`/${hash}`);
}

interface Fail { text: string; ratio: number; min: number; color: string; bg: string; tag: string }

/** Contraste WCAG de cada texto visible contra su fondo efectivo (capas con alfa mezcladas). Omite fondos con imagen/gradiente. */
async function renderedContrast(page: Page): Promise<{ checked: number; skipped: number; fails: Fail[] }> {
  return page.evaluate(() => {
    type C = { r: number; g: number; b: number; a: number };
    const parse = (c: string): C | null => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = m[1].split(/[ ,/]+/).filter(Boolean).map(parseFloat);
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    };
    const blend = (fg: C, bg: C): C => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
    const lum = (c: C) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
    const ratio = (a: C, b: C) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const hex = (c: C) => `rgb(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)})`;
    let checked = 0; let skipped = 0;
    const fails: { text: string; ratio: number; min: number; color: string; bg: string; tag: string }[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3 && n.textContent!.trim()).map((n) => n.textContent!.trim()).join(' ');
      if (!own) continue;
      if (el.closest('.sr-only, [aria-hidden="true"], svg, [disabled], option, select, noscript, script, style')) continue;
      const rect = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (rect.width === 0 || rect.height === 0 || cs.visibility === 'hidden' || cs.display === 'none') continue;
      let hidden = false;
      for (let e: HTMLElement | null = el; e; e = e.parentElement) { if (getComputedStyle(e).display === 'none') { hidden = true; break; } }
      if (hidden) continue;
      const layers: C[] = [];
      let gradient = false;
      for (let e: HTMLElement | null = el; e; e = e.parentElement) {
        const s = getComputedStyle(e);
        if (s.backgroundImage && s.backgroundImage !== 'none') { gradient = true; break; }
        const c = parse(s.backgroundColor);
        if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; }
      }
      if (gradient) { skipped++; continue; }
      let bg: C = { r: 255, g: 255, b: 255, a: 1 };
      for (const l of layers.reverse()) bg = blend(l, bg);
      const fgRaw = parse(cs.color);
      if (!fgRaw) continue;
      const fg = blend(fgRaw, bg);
      const size = parseFloat(cs.fontSize);
      const bold = parseInt(cs.fontWeight, 10) >= 700;
      const min = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
      const r = ratio(fg, bg);
      checked++;
      if (r < min - 0.01) fails.push({ text: own.slice(0, 60), ratio: Math.round(r * 100) / 100, min, color: hex(fg), bg: hex(bg), tag: `${el.tagName.toLowerCase()}.${el.className}`.slice(0, 80) });
    }
    return { checked, skipped, fails };
  });
}

for (const scheme of ['light', 'dark'] as const) for (const width of [1440, 390]) {
  test(`contraste renderizado AA en ${ROUTES.length} rutas a ${width} px · tema ${scheme === 'light' ? 'claro' : 'oscuro'}`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: scheme });
    await fresh(page);
    const all: (Fail & { route: string })[] = [];
    let checked = 0;
    for (const r of ROUTES) {
      await page.goto(`/${r}`);
      await page.waitForTimeout(200);
      const res = await renderedContrast(page);
      checked += res.checked;
      all.push(...res.fails.map((f) => ({ ...f, route: r })));
    }
    expect(checked).toBeGreaterThan(500);
    expect(all, JSON.stringify(all.slice(0, 10), null, 1)).toEqual([]);
  });
}

test('320 px: ninguna ruta tiene scroll horizontal de página', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 320, height: 640 });
  await fresh(page);
  for (const r of ROUTES) {
    await page.goto(`/${r}`);
    await page.waitForTimeout(150);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, r).toBeLessThanOrEqual(0);
  }
});

test('teclado virtual (alto 420 px): el campo del chat y Enviar quedan visibles y operables', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 420 });
  await fresh(page, '#/whatsapp');
  const input = page.getByLabel('Escribí un mensaje');
  await input.focus();
  await input.scrollIntoViewIfNeeded();
  const send = page.getByRole('button', { name: 'Enviar' });
  await expect(send).toBeInViewport();
  await input.fill('hola');
  await input.press('Enter');
  await expect(page.locator('.bubble.asistente').last()).toContainText('asistente administrativo');
});

test('teclado virtual en reserva: el CTA se alcanza con foco y no queda tapado', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 420 });
  await fresh(page, '#/reservar');
  await page.locator('#serviceTypeId').selectOption('ST-CONTROL');
  await page.locator('input[name="slot"]').first().check();
  const cta = page.getByRole('button', { name: 'Confirmar turno' });
  await cta.focus();
  await cta.scrollIntoViewIfNeeded();
  await expect(cta).toBeInViewport();
  const covered = await cta.evaluate((b) => { const r = b.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !(top === b || b.contains(top)); });
  expect(covered).toBe(false);
});

test('botonera de la demo por teclado: cambia de vista y lleva el foco al título', async ({ page }) => {
  await fresh(page, '#/');
  // La vista de muestra vive en la botonera flotante de la demo (popover nativo, abajo a la derecha).
  const demo = page.getByRole('button', { name: /Controles de la demo/ });
  await demo.focus();
  await page.keyboard.press('Enter');
  const panel = page.getByRole('dialog', { name: 'Controles de la demo' });
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: /^Recepción/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/admin$/);
  await expect(panel).toBeHidden();
  await expect(page.locator('h1')).toHaveText('Hoy y agenda');
  await expect(page.locator('h1')).toBeFocused();
});

test('agenda: DateStrip con flechas; el drawer conserva fecha y filtros y devuelve el foco', async ({ page }) => {
  await fresh(page, '#/admin');
  const monday = page.locator('.datestrip-day[data-date="2026-10-19"]');
  await monday.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.datestrip-day[data-date="2026-10-20"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.datestrip-day[data-date="2026-10-20"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('summary', { hasText: 'Filtros' }).click();
  await page.getByLabel('Profesional', { exact: true }).selectOption('PR-03');
  const appt = page.locator('.res-appt[data-appointment="A-0008"]');
  await appt.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(appt).toBeFocused();
  await expect(page.locator('.datestrip-day[data-date="2026-10-20"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Profesional', { exact: true })).toHaveValue('PR-03');
});

test('el foco que la persona puso en el contenido no se lo roba el título mientras carga el panel diferido', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  // Enfoca un día de la agenda apenas aparece, antes del próximo reintento de foco al título.
  await page.evaluate(() => {
    const mo = new MutationObserver(() => {
      const b = document.querySelector<HTMLElement>('.datestrip-day[data-date="2026-10-19"]');
      if (b) { b.focus(); mo.disconnect(); }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  });
  await page.goto('/#/admin');
  const day = page.locator('.datestrip-day[data-date="2026-10-19"]');
  // Espera a que el panel diferido (y la transición de vista, si la hay) termine de montar; después da tiempo
  // de sobra a los reintentos de foco al título (cada 50 ms) antes de verificar que el foco no se movió.
  await expect(day).toBeAttached();
  await page.waitForTimeout(400);
  await expect(day).toBeFocused({ timeout: 300 });
});

test('reduced-motion: el cambio se ve igual sin animación (borde + texto)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await fresh(page, '#/mis-turnos');
  const card = page.locator('.turno[data-appointment="A-0012"]');
  await card.getByRole('button', { name: 'Confirmar asistencia' }).click();
  await expect(card).toContainText('Actualizado recién');
  const st = await card.evaluate((el) => { const cs = getComputedStyle(el); return { anim: cs.animationName, outline: cs.outlineStyle }; });
  expect(st.anim).toBe('none');
  expect(st.outline).toBe('solid');
});

test('audio: dos tonos distintos (habla y guardado) solo tras gesto; nada antes de iniciar', async ({ page }) => {
  await page.addInitScript(() => {
    const stats = { contexts: 0, freqs: [] as number[] };
    (window as unknown as { __audio: typeof stats }).__audio = stats;
    class Param { value = 0; setValueAtTime() { return this; } linearRampToValueAtTime() { return this; } }
    class Node { connect(n: unknown) { return n; } disconnect() {} }
    class Osc extends Node { type = 'sine'; frequency = new Param(); onended = null; start() { stats.freqs.push(this.frequency.value); } stop() {} }
    class Gain extends Node { gain = new Param(); }
    class Ctx { state = 'running'; currentTime = 0; destination = new Node(); constructor() { stats.contexts++; } createOscillator() { return new Osc(); } createGain() { return new Gain(); } resume() { return Promise.resolve(); } close() { this.state = 'closed'; return Promise.resolve(); } }
    (window as unknown as { AudioContext: unknown }).AudioContext = Ctx;
  });
  await fresh(page, '#/llamada');
  await page.getByLabel('Activar tonos sintéticos suaves (opcional)').check();
  expect(await page.evaluate(() => (window as unknown as { __audio: { contexts: number } }).__audio.contexts)).toBe(0);
  await page.getByRole('button', { name: 'Probar llamada simulada' }).click();
  await expect(page.getByText('Tonos suaves activos')).toBeVisible();
  await page.getByRole('button', { name: 'Cambiar mi control o turno' }).click();
  await page.getByRole('button', { name: /Control de ortodoncia/ }).click();
  await page.getByRole('button', { name: /Escuchar horarios libres/ }).click();
  await page.getByRole('button', { name: /mar 20\/10 · 11:00/ }).click();
  await page.getByRole('button', { name: 'Confirmar cambio' }).click();
  await expect(page.locator('.call-line')).toContainText('Cambio guardado');
  const freqs = await page.evaluate(() => (window as unknown as { __audio: { freqs: number[] } }).__audio.freqs);
  expect(new Set(freqs)).toEqual(new Set([523.25, 659.25]));
});
