// Contraste WCAG medido sobre los tokens de cada propuesta. Los colores translúcidos (vidrio de B) se componen
// sobre cada fondo posible (degradé y manchas) y se informa el peor caso.
import type { Mode, Palette, Proposal } from './tokens';

type RGBA = [number, number, number, number];

export function parseColor(c: string): RGBA {
  const s = c.trim();
  if (s.startsWith('#')) {
    const h = s.slice(1);
    const n = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
    return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16), 1];
  }
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (!m) throw new Error(`Color no soportado: ${c}`);
  const [r, g, b, a = '1'] = m[1].split(',').map((x) => x.trim());
  return [Number(r), Number(g), Number(b), Number(a)];
}

/** Compone `top` (posiblemente translúcido) sobre `base` opaco. */
export function over(top: string, base: RGBA): RGBA {
  const [r, g, b, a] = parseColor(top);
  return [r * a + base[0] * (1 - a), g * a + base[1] * (1 - a), b * a + base[2] * (1 - a), 1];
}

function luminance([r, g, b]: RGBA) {
  const ch = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

export function ratio(a: RGBA, b: RGBA) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Fondos opacos sobre los que puede apoyarse una superficie: degradé y manchas. */
function grounds(c: Palette): RGBA[] {
  return [c.bg, c.bg2, ...(c.blobs ?? [])].map((x) => parseColor(x));
}

type Layer = 'bg' | 'surface' | 'surface2' | 'accent' | 'accentSoft';

/** Peor contraste de `fg` sobre la capa dada, recorriendo todos los fondos posibles. */
export function worstRatio(c: Palette, fg: keyof Palette, layer: Layer) {
  let worst = Infinity;
  for (const g of grounds(c)) {
    // Los tintes (chips, insignias) se apoyan sobre una superficie, no directo sobre el fondo.
    const base = layer === 'bg' ? g : layer === 'accentSoft' ? over(c.accentSoft, over(c.surface, g)) : over(c[layer] as string, g);
    const top = over(c[fg] as string, base);
    worst = Math.min(worst, ratio(top, base));
  }
  return worst;
}

export interface Pair { fg: keyof Palette; on: Layer; min: number; label: string }

/** Pares que la interfaz usa de verdad. 4,5 para texto; 3 para foco e indicadores no textuales. */
export const PAIRS: Pair[] = [
  { fg: 'ink', on: 'bg', min: 4.5, label: 'Texto sobre fondo' },
  { fg: 'ink', on: 'surface', min: 4.5, label: 'Texto sobre superficie' },
  { fg: 'ink', on: 'surface2', min: 4.5, label: 'Texto sobre superficie 2' },
  { fg: 'muted', on: 'bg', min: 4.5, label: 'Secundario sobre fondo' },
  { fg: 'muted', on: 'surface', min: 4.5, label: 'Secundario sobre superficie' },
  { fg: 'accentInk', on: 'bg', min: 4.5, label: 'Acento (texto) sobre fondo' },
  { fg: 'accentInk', on: 'surface', min: 4.5, label: 'Acento (texto) sobre superficie' },
  { fg: 'accentInk', on: 'accentSoft', min: 4.5, label: 'Acento sobre su tinte' },
  { fg: 'onAccent', on: 'accent', min: 4.5, label: 'Texto sobre botón primario' },
  { fg: 'accent2Ink', on: 'surface', min: 4.5, label: 'Segundo acento (texto) sobre superficie' },
  { fg: 'success', on: 'surface', min: 4.5, label: 'Éxito sobre superficie' },
  { fg: 'warn', on: 'surface', min: 4.5, label: 'Aviso sobre superficie' },
  { fg: 'danger', on: 'surface', min: 4.5, label: 'Error sobre superficie' },
  { fg: 'focus', on: 'bg', min: 3, label: 'Anillo de foco sobre fondo' },
  { fg: 'focus', on: 'surface', min: 3, label: 'Anillo de foco sobre superficie' },
];

export function measure(p: Proposal, mode: Mode) {
  const c = p.palettes[mode];
  return PAIRS.map((pair) => {
    const value = worstRatio(c, pair.fg, pair.on);
    return { ...pair, value, pass: value >= pair.min };
  });
}
