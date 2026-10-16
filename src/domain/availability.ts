import type { AppState, Reservation, ReservationStatus, ServiceWindow, Table } from './types'
import { atLocal, dateKeyOf, minutesOfDay, weekdayOf } from './time'

/** Estados que retienen mesa. Una "solicitada" todavía no tiene mesa: se asigna al aceptar. */
const HOLDING: ReservationStatus[] = ['confirmada', 'llegada', 'sentada']
export const holdsTable = (st: ReservationStatus) => HOLDING.includes(st)

export function windowsFor(s: AppState, locationId: string, dateKey: string): ServiceWindow[] {
  const wd = weekdayOf(dateKey)
  return s.serviceWindows.filter((w) => w.locationId === locationId && w.days.includes(wd))
}

export function businessDuration(s: AppState, businessId: string) {
  const b = s.businesses.find((x) => x.id === businessId)
  return { service: b?.serviceMinutes ?? 90, buffer: b?.bufferMinutes ?? 15 }
}

/** El servicio (sin margen) debe entrar dentro de la franja de atención. */
export function slotInService(s: AppState, locationId: string, dateKey: string, startMin: number, serviceMin: number): boolean {
  return windowsFor(s, locationId, dateKey).some((w) => startMin >= w.startMin && startMin + serviceMin <= w.endMin)
}

export function isPast(s: AppState, dateKey: string, startMin: number): boolean {
  const nowKey = dateKeyOf(s.clock.nowMs)
  if (dateKey < nowKey) return true
  return dateKey === nowKey && startMin < minutesOfDay(s.clock.nowMs)
}

export function locationOpenNow(s: AppState, locationId: string): boolean {
  const dk = dateKeyOf(s.clock.nowMs)
  const m = minutesOfDay(s.clock.nowMs)
  return windowsFor(s, locationId, dk).some((w) => m >= w.startMin && m < w.endMin)
}

/** Intervalos semiabiertos [inicio, fin+margen): 21:45 es válido si la reserva anterior termina 21:45. */
const overlaps = (aS: number, aE: number, bS: number, bE: number) => aS < bE && bS < aE

export function tableBusy(
  s: AppState,
  tableId: string,
  dateKey: string,
  startMin: number,
  span: number,
  excludeReservationId?: string | null,
): Reservation | { sessionId: string } | null {
  for (const r of s.reservations) {
    if (r.id === excludeReservationId) continue
    if (r.tableId !== tableId || r.dateKey !== dateKey || !holdsTable(r.status)) continue
    const { service, buffer } = businessDuration(s, r.businessId)
    if (overlaps(startMin, startMin + span, r.startMin, r.startMin + service + buffer)) return r
  }
  // Sesión abierta sin reserva (walk-in) ocupa la mesa desde que se abrió.
  for (const ts of s.tableSessions) {
    if (ts.status !== 'activa' || ts.kind !== 'mesa' || ts.reservationId) continue
    if (!ts.tableIds.includes(tableId)) continue
    if (dateKeyOf(ts.openedAt) !== dateKey) continue
    const o = minutesOfDay(ts.openedAt)
    const { service, buffer } = businessDuration(s, ts.businessId)
    if (overlaps(startMin, startMin + span, o, o + service + buffer)) return { sessionId: ts.id }
  }
  return null
}

export interface SlotQuery {
  businessId: string
  locationId: string
  dateKey: string
  startMin: number
  party: number
  sectorPref?: 'cualquiera' | 'salon' | 'terraza'
  excludeId?: string | null
}

export function tablesOf(s: AppState, locationId: string): Table[] {
  return s.tables.filter((t) => t.locationId === locationId)
}

/** Mesa libre más ajustada para el grupo; la preferencia de sector es blanda. Nunca combina mesas. */
export function findFreeTable(s: AppState, q: SlotQuery): Table | null {
  const { service, buffer } = businessDuration(s, q.businessId)
  const span = service + buffer
  const fits = tablesOf(s, q.locationId)
    .filter((t) => t.seats >= q.party)
    .filter((t) => !tableBusy(s, t.id, q.dateKey, q.startMin, span, q.excludeId))
  if (!fits.length) return null
  const pref = q.sectorPref && q.sectorPref !== 'cualquiera' ? q.sectorPref : null
  fits.sort((a, b) => {
    const pa = pref && a.sector === pref ? 0 : 1
    const pb = pref && b.sector === pref ? 0 : 1
    return a.seats - b.seats || pa - pb || a.id.localeCompare(b.id)
  })
  return fits[0]
}

/** Inicios posibles cada 15 minutos dentro del servicio. */
export function slotStarts(s: AppState, businessId: string, locationId: string, dateKey: string): number[] {
  const { service } = businessDuration(s, businessId)
  const out: number[] = []
  for (const w of windowsFor(s, locationId, dateKey)) {
    for (let m = w.startMin; m + service <= w.endMin; m += 15) out.push(m)
  }
  return out
}

export function slotAvailable(s: AppState, q: SlotQuery): boolean {
  const { service } = businessDuration(s, q.businessId)
  if (!slotInService(s, q.locationId, q.dateKey, q.startMin, service)) return false
  if (isPast(s, q.dateKey, q.startMin)) return false
  return !!findFreeTable(s, q)
}

/** Franjas con cupo del día, para el selector del cliente. */
export function freeSlots(s: AppState, q: Omit<SlotQuery, 'startMin'>): number[] {
  return slotStarts(s, q.businessId, q.locationId, q.dateKey).filter((m) => slotAvailable(s, { ...q, startMin: m }))
}

/** Alternativas del mismo día, la más próxima primero (empate: la más tardía). */
export function alternatives(s: AppState, q: SlotQuery, count = 3): number[] {
  const all = freeSlots(s, q).filter((m) => m !== q.startMin)
  // primero dentro del mismo servicio (ej: cena); si no hay, cualquier otro del día
  const win = windowsFor(s, q.locationId, q.dateKey).find((w) => q.startMin >= w.startMin && q.startMin < w.endMin)
  const same = win ? all.filter((m) => m >= win.startMin && m < win.endMin) : []
  return (same.length ? same : all)
    .sort((a, b) => Math.abs(a - q.startMin) - Math.abs(b - q.startMin) || b - a)
    .slice(0, count)
}

export function reservationStartMs(r: Pick<Reservation, 'dateKey' | 'startMin'>): number {
  return atLocal(r.dateKey, r.startMin)
}
