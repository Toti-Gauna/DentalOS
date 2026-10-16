import { describe, expect, it } from 'vitest'

// Verificación real de contraste (WCAG 2.x) de los tokens de styles.css. Objetivo AA: 4,5:1 texto normal, 3:1 componentes.
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
const pairs: [string, string, string, number][] = [
  ['tinta sobre papel', '#20291f', '#f7f3ea', 4.5],
  ['texto atenuado sobre papel', '#566052', '#f7f3ea', 4.5],
  ['texto atenuado sobre papel-2', '#566052', '#efe8d8', 4.5],
  ['texto atenuado sobre blanco', '#566052', '#ffffff', 4.5],
  ['verde sobre papel (enlaces)', '#355443', '#f7f3ea', 4.5],
  ['blanco sobre verde (botón)', '#ffffff', '#355443', 4.5],
  ['blanco sobre verde hover', '#ffffff', '#2a4538', 4.5],
  ['blanco sobre terracota (botón acento)', '#ffffff', '#a44431', 4.5],
  ['terracota sobre papel', '#a44431', '#f7f3ea', 4.5],
  ['blanco sobre tinta (banner DEMO)', '#ffffff', '#20291f', 4.5],
  ['éxito', '#276a3b', '#e3f1e6', 4.5],
  ['espera/aviso', '#7a4b00', '#fbeccb', 4.5],
  ['error', '#9c2316', '#fbe3df', 4.5],
  ['info', '#1e4f7a', '#e1edf7', 4.5],
  ['error sobre blanco', '#9c2316', '#ffffff', 4.5],
  ['callout aviso', '#4d3000', '#fbeccb', 4.5],
  ['callout error', '#6b150c', '#fbe3df', 4.5],
  ['callout info', '#12354f', '#e1edf7', 4.5],
  ['callout ok', '#164527', '#e3f1e6', 4.5],
  ['aviso de almacenamiento', '#7a4b00', '#fbeccb', 4.5],
  ['foco sobre papel (componente 3:1)', '#0b57d0', '#f7f3ea', 3],
  ['borde de campo sobre blanco (componente 3:1)', '#8f8a79', '#ffffff', 3],
  ['blanco sobre terracota hover', '#ffffff', '#8b3626', 4.5],
]
describe('Contraste de tokens (WCAG 2.2 AA, medido)', () => {
  for (const [name, fg, bg, min] of pairs) {
    it(`${name}: ${fg} / ${bg} ≥ ${min}:1`, () => {
      expect(ratio(fg, bg)).toBeGreaterThanOrEqual(min)
    })
  }
})
