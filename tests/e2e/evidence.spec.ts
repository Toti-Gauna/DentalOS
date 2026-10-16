import { test } from '@playwright/test';

// Capturas de evidencia: solo con EVIDENCE=1 (npm run evidence). Se guardan en docs/evidence.
test.skip(!process.env.EVIDENCE, 'Solo para regenerar evidencia visual');

const SHOTS: [string, number, string][] = [
  ['inicio-1440', 1440, '#/'], ['inicio-390', 390, '#/'], ['reserva-1440', 1440, '#/reservar'],
  ['whatsapp-1440', 1440, '#/whatsapp'], ['agenda-1440', 1440, '#/admin'], ['agenda-390', 390, '#/admin'],
  ['odontograma-1440', 1440, '#/admin/personas/P-001/odontograma'], ['presupuestos-1440', 1440, '#/admin/presupuestos'],
  ['informes-1440', 1440, '#/admin/informes'], ['llamada-1440', 1440, '#/llamada'],
];

test('capturas', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  for (const [name, w, hash] of SHOTS) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto(`/${hash}`);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `docs/evidence/${name}.png` });
  }
});
