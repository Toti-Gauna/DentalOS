import { audit, base, fail, nextId, ok, type Ctx, type Outcome } from './core'
import type { AppState, BusinessId, Order, TableSession } from './types'

export function activeSessionAt(s: AppState, tableId: string): TableSession | undefined {
  return s.tableSessions.find((x) => x.status === 'activa' && x.tableIds.includes(tableId))
}

export function openSession(
  s: AppState,
  ctx: Ctx,
  p: {
    businessId: BusinessId
    locationId: string
    kind: 'mesa' | 'retiro'
    tableIds: string[]
    party: number
    reservationId?: string | null
    label: string
  },
): Outcome<TableSession> {
  for (const t of p.tableIds) {
    const ex = activeSessionAt(s, t)
    if (ex) {
      const tb = s.tables.find((x) => x.id === t)
      return fail('mesa-ocupada', `La mesa ${tb?.label ?? t} ya tiene una sesión activa (${ex.id}). Elegí otra mesa libre.`, { sessionId: ex.id })
    }
  }
  const ts: TableSession = {
    id: nextId(s, 'S'),
    ...base(s, p.businessId),
    locationId: p.locationId,
    kind: p.kind,
    tableIds: p.tableIds,
    party: p.party,
    reservationId: p.reservationId ?? null,
    status: 'activa',
    openedAt: ctx.now,
    closedAt: null,
    splitPlan: null,
    closeException: null,
    label: p.label,
  }
  s.tableSessions.push(ts)
  audit(s, ctx, p.businessId, 'session.opened', 'TableSession', ts.id, `Sesión ${ts.id} abierta (${p.label})`)
  return ok(ts)
}

const DEAD: Order['status'][] = ['rechazado', 'cancelado']
export function billableOrders(s: AppState, sessionId: string): Order[] {
  return s.orders.filter((o) => o.sessionId === sessionId && !DEAD.includes(o.status))
}
export function sessionTotal(s: AppState, sessionId: string): number {
  return billableOrders(s, sessionId).reduce((a, o) => a + o.totalCents, 0)
}
export function sessionPaid(s: AppState, sessionId: string): number {
  return s.payments.filter((p) => p.sessionId === sessionId && p.status === 'registrado').reduce((a, p) => a + p.amountCents, 0)
}
export const sessionBalance = (s: AppState, sessionId: string) => sessionTotal(s, sessionId) - sessionPaid(s, sessionId)

/** Líneas facturables con indicación de si ya fueron asignadas a un pago. */
export function billableLines(s: AppState, sessionId: string) {
  const paid = new Set(s.payments.filter((p) => p.sessionId === sessionId && p.status === 'registrado').flatMap((p) => p.lineIds))
  return billableOrders(s, sessionId).flatMap((o) => o.lines.map((l) => ({ order: o, line: l, paid: paid.has(l.id) })))
}
