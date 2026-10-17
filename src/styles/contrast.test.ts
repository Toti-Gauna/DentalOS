// Medición WCAG 2.x de los pares de color usados en la UI, leyendo los tokens reales de app.css.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8');
const token = (name: string) => {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`token ${name} no encontrado`);
  return m[1];
};
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const W = '#ffffff';
// [descripción, texto, fondo, mínimo]
const PAIRS: [string, string, string, number][] = [
  ['texto sobre fondo', token('ink'), token('bg'), 4.5],
  ['texto sobre superficie', token('ink'), W, 4.5],
  ['secundario sobre fondo', token('secondary'), token('bg'), 4.5],
  ['secundario sobre superficie', token('secondary'), W, 4.5],
  ['enlace/primario sobre fondo', token('primary'), token('bg'), 4.5],
  ['botón primario', W, token('primary'), 4.5],
  ['banner', W, token('ink'), 4.5],
  ['badge ok', token('primary-strong'), token('primary-50'), 4.5],
  ['badge aviso', token('warn'), token('warn-50'), 4.5],
  ['badge info', token('info'), token('info-50'), 4.5],
  ['error inline', token('error'), W, 4.5],
  ['resumen de error', token('error'), token('error-50'), 4.5],
  ['botón peligro', W, token('error'), 4.5],
  ['texto en tarjeta próximo turno', '#d7e7e4', token('primary'), 4.5],
  ['texto secundario en llamada', '#c9d6d4', token('ink'), 4.5],
  ['texto en tag arena', token('ink'), token('sand-50'), 4.5],
  ['oro para texto (sonidos activos)', token('gold-ink'), token('gold-50'), 4.5],
  ['barra lateral del panel', '#eef5f3', token('ink'), 4.5],
  ['módulo en barra lateral', token('on-dark-muted'), token('ink'), 4.5],
  ['pie de página', token('on-dark-muted'), token('ink'), 4.5],
  ['foco (no texto, 3:1)', token('focus'), token('bg'), 3],
  ['borde de campo sobre superficie (no texto, 3:1)', token('line-strong'), W, 3],
  ['borde de campo sobre fondo (no texto, 3:1)', token('line-strong'), token('bg'), 3],
];

// Fondo ambiental: peor caso = dos manchas superpuestas en su alfa máximo sobre el fondo.
const alpha = (name: string) => {
  const m = css.match(new RegExp(`--${name}:\\s*([\\d.]+)`));
  if (!m) throw new Error(`alfa ${name} no encontrado`);
  return Number(m[1]);
};
const mix = (fg: string, a: number, bg: string) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(fg.slice(i, i + 2), 16) * a + parseInt(bg.slice(i, i + 2), 16) * (1 - a)).toString(16).padStart(2, '0')).join('');
const a1 = alpha('aurora-a1');
const AMBIENT: [string, string][] = [
  ['teal + cielo', mix(token('aurora-sky'), a1, mix(token('aurora-teal'), a1, token('bg')))],
  ['oro', mix(token('aurora-gold'), alpha('aurora-a2'), token('bg'))],
  ['chicos: sol + rosa', mix(token('kids-pink'), a1, mix(token('kids-sun'), a1, token('bg')))],
];
for (const [name, bg] of AMBIENT) {
  PAIRS.push([`texto sobre fondo animado (${name})`, token('ink'), bg, 4.5]);
  PAIRS.push([`secundario sobre fondo animado (${name})`, token('secondary'), bg, 4.5]);
  PAIRS.push([`primario sobre fondo animado (${name})`, token('primary'), bg, 4.5]);
}

describe('contraste AA de tokens', () => {
  for (const [name, fg, bg, min] of PAIRS) {
    it(`${name}: ${fg} / ${bg} ≥ ${min}`, () => {
      expect(ratio(fg, bg)).toBeGreaterThanOrEqual(min);
    });
  }
});
