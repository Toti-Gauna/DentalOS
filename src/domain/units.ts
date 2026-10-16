export type Unit = 'g' | 'kg' | 'ml' | 'l' | 'u'
export type BaseUnit = 'g' | 'ml' | 'u'
const FACTORS: Record<Unit, { base: BaseUnit; factor: number }> = {
  g: { base: 'g', factor: 1 },
  kg: { base: 'g', factor: 1000 },
  ml: { base: 'ml', factor: 1 },
  l: { base: 'ml', factor: 1000 },
  u: { base: 'u', factor: 1 },
}
/** Convierte a la unidad base del insumo; null si la unidad es incompatible (g vs ml, etc.). */
export function toBase(qty: number, unit: Unit, target: BaseUnit): number | null {
  const f = FACTORS[unit]
  if (!f || f.base !== target) return null
  const v = qty * f.factor
  return Number.isInteger(v) ? v : Math.round(v)
}
export const baseOf = (u: Unit): BaseUnit => FACTORS[u].base
