import { describe, expect, it } from 'vitest';
import { measure, over, parseColor, ratio } from './contrast';
import { PROPOSALS } from './tokens';

describe('contraste de las tres propuestas (peor caso, claro y oscuro)', () => {
  it('compone colores translúcidos sobre el fondo', () => {
    expect(over('rgba(255, 255, 255, 0.5)', [0, 0, 0, 1]).slice(0, 3).map(Math.round)).toEqual([128, 128, 128]);
    expect(ratio(parseColor('#000'), parseColor('#fff'))).toBeCloseTo(21, 0);
  });

  for (const p of PROPOSALS) {
    for (const mode of ['light', 'dark'] as const) {
      for (const r of measure(p, mode)) {
        it(`${p.letter} · ${mode === 'light' ? 'claro' : 'oscuro'} · ${r.label} ≥ ${r.min}`, () => {
          expect(r.value).toBeGreaterThanOrEqual(r.min);
        });
      }
    }
  }
});
