import { mkdirSync } from 'node:fs';
import { test } from './fixtures';

// Capturas reproducibles sobre la seed inicial: solo con EVIDENCE=1 (npm run evidence).
// EVIDENCE_DIR elige carpeta (p. ej. docs/evidence/before o docs/evidence/after).
// EVIDENCE_SCHEME=dark captura en modo oscuro (archivos con sufijo -dark).
test.skip(!process.env.EVIDENCE, 'Solo para regenerar evidencia visual');

const DIR = process.env.EVIDENCE_DIR ?? 'docs/evidence/after';
const VIEWPORTS = (process.env.EVIDENCE_VIEWPORTS ?? '390,768,1440').split(',').map(Number);
const SCHEME = process.env.EVIDENCE_SCHEME === 'dark' ? 'dark' : 'light';
const ROUTES: [string, string][] = [
  ['inicio', '#/'], ['reserva', '#/reservar'], ['mis-turnos', '#/mis-turnos'], ['whatsapp', '#/whatsapp'],
  ['agenda', '#/admin'], ['bandeja', '#/admin/bandeja'], ['ficha', '#/admin/personas/P-003'],
  ['odontograma', '#/admin/personas/P-008/odontograma'], ['presupuestos', '#/admin/presupuestos'], ['aprender', '#/aprender'],
  ['chicos', '#/chicos'], ['ortodoncia', '#/admin/ortodoncia'],
];

test('capturas por viewport', async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync(DIR, { recursive: true });
  // Capturas deterministas: sin transiciones ni fondo en movimiento.
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: SCHEME });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  for (const w of VIEWPORTS) {
    await page.setViewportSize({ width: w, height: w < 800 ? 844 : 900 });
    for (const [name, hash] of ROUTES) {
      await page.goto(`/${hash}`);
      await page.waitForTimeout(350);
      await page.screenshot({ path: `${DIR}/${name}-${w}${SCHEME === 'dark' ? '-dark' : ''}.jpg`, type: 'jpeg', quality: 62 });
    }
  }
});
