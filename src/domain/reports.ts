import { expectedCash } from './cmd-cash'
import { dateKeyOf } from './time'
import type { AppState, BusinessId, Channel, OrderStatus, ReservationStatus } from './types'
import { stampsOf } from './cmd-engage'

export interface ReportFilter {
  businessId: BusinessId
  locationId: string | 'todas'
  from: string
  to: string
  channel: Channel | 'todos'
}

const DELIVERED: OrderStatus[] = ['servido', 'retirado', 'cerrado']

/** Todo se deriva de pedidos, caja, stock y eventos: nada se fabrica (sin MRR, sin beneficio). */
export function buildReport(s: AppState, f: ReportFilter) {
  const inRange = (ms: number) => {
    const k = dateKeyOf(ms)
    return k >= f.from && k <= f.to
  }
  const locOk = (id: string) => f.locationId === 'todas' || f.locationId === id
  const orders = s.orders.filter((o) => o.businessId === f.businessId && locOk(o.locationId) && inRange(o.createdAt) && (f.channel === 'todos' || o.channel === f.channel))
  const byStatus: Partial<Record<OrderStatus, number>> = {}
  for (const o of orders) byStatus[o.status] = (byStatus[o.status] ?? 0) + 1
  const delivered = orders.filter((o) => DELIVERED.includes(o.status))
  const salesCents = delivered.reduce((a, o) => a + o.totalCents, 0)
  const byChannel: Partial<Record<Channel, number>> = {}
  for (const o of orders) byChannel[o.channel] = (byChannel[o.channel] ?? 0) + 1

  const reservations = s.reservations.filter((r) => r.businessId === f.businessId && locOk(r.locationId) && r.dateKey >= f.from && r.dateKey <= f.to && (f.channel === 'todos' || r.channel === f.channel))
  const resByStatus: Partial<Record<ReservationStatus, number>> = {}
  for (const r of reservations) resByStatus[r.status] = (resByStatus[r.status] ?? 0) + 1

  const cashSessions = s.cashSessions
    .filter((c) => c.businessId === f.businessId && locOk(c.locationId) && inRange(c.openedAt))
    .map((c) => ({
      id: c.id,
      status: c.status,
      expectedCents: c.status === 'cerrada' ? (c.expectedCashCents ?? 0) : expectedCash(s, c),
      countedCents: c.countedCashCents,
      differenceCents: c.differenceCents,
      reason: c.closeReason,
    }))
  const payments = s.payments.filter((p) => p.businessId === f.businessId && p.status === 'registrado' && inRange(p.createdAt) && locOk(s.cashSessions.find((c) => c.id === p.cashSessionId)?.locationId ?? ''))
  const byMethod: Record<string, number> = {}
  for (const p of payments) byMethod[p.method] = (byMethod[p.method] ?? 0) + p.amountCents
  const collectedCents = payments.reduce((a, p) => a + p.amountCents, 0)

  const ingredients = s.ingredients.filter((i) => i.businessId === f.businessId)
  const events = s.tastingEvents.filter((e) => e.businessId === f.businessId && e.dateKey >= f.from && e.dateKey <= f.to)
  const eventSeats = events.map((e) => {
    const held = s.eventBookings.filter((b) => b.eventId === e.id && ['inscripto', 'oferta'].includes(b.status)).length
    return { id: e.id, title: e.title, capacity: e.capacity, held, waiting: s.eventBookings.filter((b) => b.eventId === e.id && b.status === 'espera').length }
  })
  const runs = s.runs.filter((r) => r.businessId === f.businessId && inRange(r.createdAt))
  const runsByStatus: Record<string, number> = {}
  for (const r of runs) runsByStatus[r.status] = (runsByStatus[r.status] ?? 0) + 1
  const passports = s.passports.filter((p) => p.businessId === f.businessId)
  const customers = s.customers.filter((c) => c.businessId === f.businessId && !c.mergedInto)

  const empty = !orders.length && !reservations.length && !payments.length && !events.length && !runs.length
  return {
    empty,
    orders: { count: orders.length, byStatus, byChannel, salesCents, delivered: delivered.length },
    reservations: { count: reservations.length, byStatus: resByStatus },
    cash: { sessions: cashSessions, collectedCents, byMethod },
    stock: { low: ingredients.filter((i) => i.alertState === 'bajo').length, out: ingredients.filter((i) => i.alertState === 'agotado').length, total: ingredients.length },
    events: eventSeats,
    automations: { count: runs.length, byStatus: runsByStatus, campaignPreviews: s.campaignPreviews.filter((c) => c.businessId === f.businessId && inRange(c.at)).length },
    passport: {
      started: passports.reduce((a, p) => a + p.metrics.started, 0),
      completed: passports.reduce((a, p) => a + p.metrics.completed, 0),
      saved: passports.reduce((a, p) => a + p.metrics.saved, 0),
      usedInCart: passports.reduce((a, p) => a + p.metrics.usedInCart, 0),
      badgesFromVisits: customers.filter((c) => stampsOf(s, c.id) >= 5).length,
    },
    profit: null as null, // sin costos reales no hay beneficio: no se fabrica
  }
}
