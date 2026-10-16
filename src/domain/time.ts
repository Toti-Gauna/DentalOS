// Reloj simulado: epoch ms (UTC) + zona fija America/Argentina/Buenos_Aires (UTC-3, sin DST).
// Ninguna función de dominio llama a Date.now(): el reloj vive en el estado.
export const TZ = 'America/Argentina/Buenos_Aires'
export const TZ_OFFSET_MIN = -180
const MIN = 60_000

export function toLocalDate(ms: number): Date {
  return new Date(ms + TZ_OFFSET_MIN * MIN)
}
const p2 = (n: number) => String(n).padStart(2, '0')

export function dateKeyOf(ms: number): string {
  const d = toLocalDate(ms)
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`
}
export function minutesOfDay(ms: number): number {
  const d = toLocalDate(ms)
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}
/** ms UTC de una fecha local (YYYY-MM-DD) + minutos desde medianoche local. */
export function atLocal(dateKey: string, minutes: number): number {
  const [y, m, d] = dateKey.split('-').map(Number)
  return Date.UTC(y, m - 1, d, 0, 0, 0) - TZ_OFFSET_MIN * MIN + minutes * MIN
}
/** 0=domingo … 6=sábado */
export function weekdayOf(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}
export function addDays(dateKey: string, n: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return `${dt.getUTCFullYear()}-${p2(dt.getUTCMonth() + 1)}-${p2(dt.getUTCDate())}`
}
export function isValidDateKey(k: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return false
  return addDays(k, 0) === k
}
export function hhmm(min: number): string {
  return `${p2(Math.floor(min / 60))}:${p2(min % 60)}`
}
export function parseHHMM(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim())
  if (!m) return null
  const h = Number(m[1])
  const mi = Number(m[2])
  if (h > 23 || mi > 59) return null
  return h * 60 + mi
}
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
export const dayName = (dateKey: string) => DIAS[weekdayOf(dateKey)]
export const monthName = (m: number) => MESES[m - 1]
export function fmtDateShort(dateKey: string): string {
  const [, m, d] = dateKey.split('-')
  return `${dayName(dateKey)} ${Number(d)}/${m}`
}
export function fmtDateLong(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  return `${dayName(dateKey)} ${d} de ${monthName(m)} de ${y}`
}
export function fmtClock(ms: number): string {
  return `${fmtDateShort(dateKeyOf(ms))} ${hhmm(minutesOfDay(ms))}`
}
export function fmtDateTime(ms: number): string {
  const dk = dateKeyOf(ms)
  const [y, m, d] = dk.split('-')
  return `${d}/${m}/${y} ${hhmm(minutesOfDay(ms))}`
}
export const MINUTE = MIN
export const HOUR = 60 * MIN

/** Día simulado inicial: lunes 19/10/2026 10:00 ART. */
export const SEED_CLOCK_MS = atLocal('2026-10-19', 10 * 60)
