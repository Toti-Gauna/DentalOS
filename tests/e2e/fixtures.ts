import { test as base } from '@playwright/test';

// El selector inicial de vista (lote 3) aparece en la primera visita. Las pruebas que no tratan sobre él parten con
// la pregunta ya respondida; las que sí, usan `@playwright/test` directo (ver shell-demo.spec.ts).
export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.addInitScript(() => {
      try {
        const k = 'dentalos.demo.v1:ui';
        if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify({ roleChosen: true }));
      } catch { /* sin storage */ }
    });
    await provide(page);
  },
});
export { expect, type Page, type Locator } from '@playwright/test';
