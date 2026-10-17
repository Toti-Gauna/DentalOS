// Medición WCAG 2.x de los pares de color usados en la UI, leyendo los tokens reales de app.css, en tema claro y oscuro.
// Los tokens se declaran como `--x: #hex` o `--x: light-dark(#claro, #oscuro)`; también se resuelven alias `var(--y)`.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type Theme = 'claro' | 'oscuro';
const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8');
const root = css.slice(css.indexOf(':root {\n'), css.indexOf('\n}\n', css.indexOf(':root {\n')));

const token = (name: string, theme: Theme): string => {
  const m = root.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!m) throw new Error(`token ${name} no encontrado`);
  const v = m[1].trim();
  const ld = v.match(/^light-dark\(\s*(#[0-9a-fA-F]{6})\s*,\s*(#[0-9a-fA-F]{6})\s*\)$/);
  if (ld) return theme === 'claro' ? ld[1] : ld[2];
  const alias = v.match(/^var\(--([\w-]+)\)$/);
  if (alias) return token(alias[1], theme);
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
  throw new Error(`token ${name} no es un color medible: ${v}`);
};
const alpha = (name: string) => {
  const m = root.match(new RegExp(`--${name}:\\s*([\\d.]+)`));
  if (!m) throw new Error(`alfa ${name} no encontrado`);
  return Number(m[1]);
};
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const mix = (fg: string, a: number, bg: string) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(fg.slice(i, i + 2), 16) * a + parseInt(bg.slice(i, i + 2), 16) * (1 - a)).toString(16).padStart(2, '0')).join('');

// [descripción, texto, fondo, mínimo]; cada par se evalúa en los dos temas.
const pairs = (t: Theme): [string, string, string, number][] => {
  const k = (n: string) => token(n, t);
  const P: [string, string, string, number][] = [
    ['texto sobre fondo', k('ink'), k('bg'), 4.5],
    ['texto sobre superficie', k('ink'), k('surface'), 4.5],
    ['texto sobre superficie 2', k('ink'), k('surface-2'), 4.5],
    ['texto sobre superficie 3', k('ink'), k('surface-3'), 4.5],
    ['secundario sobre fondo', k('secondary'), k('bg'), 4.5],
    ['secundario sobre superficie', k('secondary'), k('surface'), 4.5],
    ['secundario sobre superficie 3 (deshabilitado)', k('secondary'), k('surface-3'), 4.5],
    ['enlace/primario sobre fondo', k('primary'), k('bg'), 4.5],
    ['enlace/primario sobre superficie', k('primary'), k('surface'), 4.5],
    ['primario fuerte sobre tinte', k('primary-strong'), k('primary-50'), 4.5],
    ['botón primario', k('on-primary'), k('primary-fill'), 4.5],
    ['botón primario (hover)', k('on-primary'), k('primary-fill-strong'), 4.5],
    ['franja de demo / pie / barra lateral', k('on-inverse'), k('inverse'), 4.5],
    ['texto apagado sobre inverso', k('on-inverse-muted'), k('inverse'), 4.5],
    ['botón en superficie inversa', k('on-inverse'), k('inverse-2'), 4.5],
    ['tarjeta de marca', k('on-inverse'), k('brand-card'), 4.5],
    ['texto apagado en tarjeta de marca', k('on-inverse-muted'), k('brand-card'), 4.5],
    ['ítem activo de la barra lateral', k('nav-current-ink'), k('nav-current-bg'), 4.5],
    ['badge aviso', k('warn'), k('warn-50'), 4.5],
    ['badge info', k('info'), k('info-50'), 4.5],
    ['error inline', k('error'), k('surface'), 4.5],
    ['resumen de error', k('error'), k('error-50'), 4.5],
    ['botón peligro', k('on-primary'), k('error-fill'), 4.5],
    ['texto en tag arena', k('ink'), k('sand-50'), 4.5],
    ['oro para texto', k('gold-ink'), k('gold-50'), 4.5],
    ['código', k('ink'), k('code-bg'), 4.5],
    ['burbuja entrante', k('ink'), k('bubble-in'), 4.5],
    ['burbuja saliente', k('ink'), k('bubble-out'), 4.5],
    ['fecha secundaria en burbuja saliente', k('secondary'), k('bubble-out'), 4.5],
    ['Chicos: héroe', k('ink'), k('kid-sun-bg'), 4.5],
    ['Chicos: tarjeta 1', k('secondary'), k('kid-1'), 4.5],
    ['Chicos: tarjeta 2', k('secondary'), k('kid-2'), 4.5],
    ['Chicos: tarjeta 3', k('secondary'), k('kid-3'), 4.5],
    ['Chicos: tarjeta 4', k('secondary'), k('kid-4'), 4.5],
    ['Chicos: cuento', k('ink'), k('kid-sky'), 4.5],
    ['Chicos: cepillado', k('secondary'), k('kid-mint'), 4.5],
    ['Chicos: banda', k('secondary'), k('kid-band'), 4.5],
    ['foco sobre fondo (no texto, 3:1)', k('focus'), k('bg'), 3],
    ['foco sobre superficie (no texto, 3:1)', k('focus'), k('surface'), 3],
    ['borde de campo sobre superficie (no texto, 3:1)', k('line-strong'), k('surface'), 3],
    ['borde de campo sobre fondo (no texto, 3:1)', k('line-strong'), k('bg'), 3],
  ];
  // Fondo ambiental: peor caso = dos manchas superpuestas en su alfa máximo sobre el fondo.
  const a1 = alpha('aurora-a1');
  const ambient: [string, string][] = [
    ['teal + cielo', mix(k('aurora-sky'), a1, mix(k('aurora-teal'), a1, k('bg')))],
    ['oro', mix(k('aurora-gold'), alpha('aurora-a2'), k('bg'))],
    ['chicos: sol + rosa', mix(k('kids-pink'), a1, mix(k('kids-sun'), a1, k('bg')))],
  ];
  for (const [name, bg] of ambient) {
    P.push([`texto sobre fondo animado (${name})`, k('ink'), bg, 4.5]);
    P.push([`secundario sobre fondo animado (${name})`, k('secondary'), bg, 4.5]);
    P.push([`primario sobre fondo animado (${name})`, k('primary'), bg, 4.5]);
  }
  return P;
};

for (const theme of ['claro', 'oscuro'] as const) {
  describe(`contraste AA de tokens · tema ${theme}`, () => {
    for (const [name, fg, bg, min] of pairs(theme)) {
      it(`${name}: ${fg} / ${bg} ≥ ${min}`, () => {
        expect(ratio(fg, bg)).toBeGreaterThanOrEqual(min);
      });
    }
  });
}
