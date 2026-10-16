// Importes siempre en centavos enteros (ARS ficticios).
const nf = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 })

export function fmtARS(cents: number): string {
  return nf.format(cents / 100).replace(/ /g, ' ')
}
export const isCents = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n)

/** Divide `total` en `n` partes enteras: el resto va al último pago (10000,00 / 3 = 3333,33 + 3333,33 + 3333,34). */
export function splitEqual(totalCents: number, n: number): number[] {
  if (!Number.isInteger(n) || n < 1) throw new Error('partes inválidas')
  const base = Math.floor(totalCents / n)
  const parts = Array.from({ length: n }, () => base)
  parts[n - 1] += totalCents - base * n
  return parts
}
/** "1.234,50" | "1234.5" | "1234,5" → centavos, o null si es inválido. */
export function parseARSInput(s: string): number | null {
  const t = s.trim().replace(/\$/g, '').replace(/\s/g, '')
  if (!t) return null
  let norm = t
  if (t.includes(',')) norm = t.replace(/\./g, '').replace(',', '.')
  if (!/^-?\d+(\.\d{1,2})?$/.test(norm)) return null
  return Math.round(Number(norm) * 100)
}
