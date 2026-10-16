import { audit, base, byId, dup, emit, fail, nextId, nextNum, ok } from './core'
import { billableLines, billableOrders, sessionBalance, sessionTotal } from './sessions'
import { splitEqual } from './money'
import type { AppState, CashSession, PaymentSimulation } from './types'
import type { Handler } from './cmd-commerce'

export function openCashFor(s: AppState, locationId: string): CashSession | undefined {
  return s.cashSessions.find((c) => c.locationId === locationId && c.status === 'abierta')
}

export function expectedCash(s: AppState, cs: CashSession): number {
  const cashIn = s.payments
    .filter((p) => p.cashSessionId === cs.id && p.status === 'registrado' && p.method === 'efectivo')
    .reduce((a, p) => a + p.amountCents, 0)
  const mov = cs.movements.reduce((a, m) => a + (m.kind === 'ingreso' ? m.amountCents : -m.amountCents), 0)
  return cs.openingFloatCents + cashIn + mov
}

const cashOpen: Handler = (s, c, ctx) => {
  const loc = byId(s.locations, c.locationId)
  if (!loc || loc.businessId !== c.businessId) return fail('sede-invalida', 'La sede no corresponde al negocio.')
  if (openCashFor(s, c.locationId)) return fail('caja-abierta', 'Ya hay una caja abierta en esta sede.')
  if (!Number.isInteger(c.openingFloatCents) || c.openingFloatCents < 0) return fail('importe-invalido', 'El fondo inicial debe ser un importe en centavos mayor o igual a cero.')
  const cs: CashSession = {
    id: nextId(s, 'CS'),
    ...base(s, c.businessId),
    locationId: c.locationId,
    status: 'abierta',
    openingFloatCents: c.openingFloatCents,
    movements: [],
    openedAt: ctx.now,
    closedAt: null,
    countedCashCents: null,
    expectedCashCents: null,
    differenceCents: null,
    closeReason: null,
  }
  s.cashSessions.push(cs)
  audit(s, ctx, c.businessId, 'cash.opened', 'CashSession', cs.id, `Caja ${cs.id} abierta con fondo ${c.openingFloatCents / 100}`)
  return ok({ cashSessionId: cs.id })
}

const cashMovement: Handler = (s, c, ctx) => {
  const cs = byId(s.cashSessions, c.cashSessionId)
  if (!cs || cs.status !== 'abierta') return fail('caja-cerrada', 'La caja no está abierta.')
  if (!Number.isInteger(c.amountCents) || c.amountCents <= 0) return fail('importe-invalido', 'El importe debe ser positivo.')
  const reason = (c.reason ?? '').trim()
  if (!reason) return fail('motivo-requerido', 'Indicá el motivo del movimiento.')
  if (c.kind === 'egreso' && expectedCash(s, cs) - c.amountCents < 0) return fail('efectivo-insuficiente', 'El egreso supera el efectivo esperado en caja.')
  cs.movements.push({ id: nextId(s, 'CM'), kind: c.kind, amountCents: c.amountCents, reason, at: ctx.now })
  cs.version++
  audit(s, ctx, cs.businessId, 'cash.movement', 'CashSession', cs.id, `${c.kind} ${c.amountCents / 100}: ${reason}`)
  return ok()
}

const cashSplit: Handler = (s, c, ctx) => {
  const ses = byId(s.tableSessions, c.sessionId)
  if (!ses || ses.status !== 'activa') return fail('sesion-inexistente', 'La cuenta no está abierta.')
  if (!Number.isInteger(c.n) || c.n < 2 || c.n > 20) return fail('partes-invalidas', 'Elegí entre 2 y 20 partes.')
  if (s.payments.some((p) => p.sessionId === ses.id && p.status === 'registrado')) return fail('ya-hay-pagos', 'Ya hay pagos registrados: no se puede cambiar el plan de división.')
  const total = sessionTotal(s, ses.id)
  if (total <= 0) return fail('sin-importe', 'La cuenta no tiene importe para dividir.')
  ses.splitPlan = { n: c.n, shares: splitEqual(total, c.n) }
  ses.version++
  audit(s, ctx, ses.businessId, 'cash.split', 'TableSession', ses.id, `Cuenta dividida en ${c.n}: ${ses.splitPlan.shares.map((x) => x / 100).join(' + ')}`)
  return ok({ shares: ses.splitPlan.shares })
}

const payRegister: Handler = (s, c, ctx) => {
  if (!c.operationId) return fail('sin-operacion', 'Falta el identificador de la operación.')
  const existing = s.payments.find((p) => p.operationId === c.operationId)
  if (existing) return dup({ paymentId: existing.id, receiptNo: existing.receiptNo }, `Ese pago ya estaba registrado (${existing.receiptNo}). No se descuenta dos veces.`)
  const ses = byId(s.tableSessions, c.sessionId)
  if (!ses) return fail('sesion-inexistente', 'Cuenta inexistente.')
  if (ses.status !== 'activa') return fail('cuenta-cerrada', 'La cuenta ya está cerrada.')
  const cash = openCashFor(s, ses.locationId)
  if (!cash) return fail('caja-cerrada', 'Abrí la caja de esta sede antes de registrar pagos.')
  if (!Number.isInteger(c.amountCents) || c.amountCents <= 0) return fail('importe-invalido', 'El importe debe ser un número positivo en centavos.')
  const balance = sessionBalance(s, ses.id)
  if (balance <= 0) return fail('sin-saldo', 'La cuenta no tiene saldo pendiente.')
  const method = c.method ?? 'efectivo'
  if (!['efectivo', 'tarjeta', 'transferencia'].includes(method)) return fail('medio-invalido', 'Medio de pago inválido.')

  let lineIds: string[] = []
  let shareIndex: number | null = null
  let adjustment = 0
  if (c.lineIds?.length) {
    const lines = billableLines(s, ses.id)
    let sum = 0
    for (const id of c.lineIds as string[]) {
      const bl = lines.find((x) => x.line.id === id)
      if (!bl) return fail('linea-invalida', 'Una línea no pertenece a esta cuenta.')
      if (bl.paid) return fail('linea-ya-asignada', `“${bl.line.name}” ya fue asignado a otro pago.`)
      sum += bl.line.lineCents
    }
    if (new Set(c.lineIds).size !== c.lineIds.length) return fail('linea-duplicada', 'Una línea está repetida en el pago.')
    if (sum !== c.amountCents) return fail('importe-no-coincide', `Los ítems elegidos suman ${(sum / 100).toFixed(2)}; el importe ingresado es distinto.`)
    lineIds = c.lineIds
  } else if (c.shareIndex !== undefined && c.shareIndex !== null) {
    const plan = ses.splitPlan
    if (!plan || c.shareIndex < 0 || c.shareIndex >= plan.n) return fail('parte-invalida', 'Esa parte no existe en el plan de división.')
    if (s.payments.some((p) => p.sessionId === ses.id && p.status === 'registrado' && p.shareIndex === c.shareIndex)) return fail('parte-ya-pagada', 'Esa parte ya fue pagada.')
    if (plan.shares[c.shareIndex] !== c.amountCents) return fail('importe-no-coincide', `La parte ${c.shareIndex + 1} es de ${(plan.shares[c.shareIndex] / 100).toFixed(2)}.`)
    shareIndex = c.shareIndex
    adjustment = plan.shares[c.shareIndex] - Math.floor(sessionTotal(s, ses.id) / plan.n)
  }
  if (c.amountCents > balance) return fail('sobrepago', `El importe supera el saldo (${(balance / 100).toFixed(2)}). No se acepta un sobrepago silencioso.`)
  const n = nextNum(s, 'P')
  const pay: PaymentSimulation = {
    id: `P-${String(n).padStart(3, '0')}`,
    ...base(s, ses.businessId),
    sessionId: ses.id,
    cashSessionId: cash.id,
    operationId: c.operationId,
    amountCents: c.amountCents,
    method,
    lineIds,
    shareIndex,
    status: 'registrado',
    receiptNo: `DEMO-${String(n).padStart(4, '0')}`,
    adjustmentCents: adjustment,
  }
  s.payments.push(pay)
  audit(s, ctx, ses.businessId, 'payment.registered', 'PaymentSimulation', pay.id, `Pago DEMO ${pay.receiptNo} ${c.amountCents / 100} (${method}). No se realizó ningún cargo.`, c.operationId)
  return ok({ paymentId: pay.id, receiptNo: pay.receiptNo, balance: sessionBalance(s, ses.id) })
}

const sessionClose: Handler = (s, c, ctx) => {
  const ses = byId(s.tableSessions, c.sessionId)
  if (!ses) return fail('sesion-inexistente', 'Cuenta inexistente.')
  if (ses.status === 'cerrada') return dup({}, 'La cuenta ya estaba cerrada.')
  const orders = billableOrders(s, ses.id)
  const open = orders.filter((o) => ['enviado', 'aceptado', 'en_preparacion', 'listo'].includes(o.status))
  if (open.length) return fail('pedidos-pendientes', `Hay pedidos sin entregar (${open.map((o) => o.id).join(', ')}). Cerrá la cuenta cuando estén servidos o retirados.`)
  const balance = sessionBalance(s, ses.id)
  if (balance > 0) {
    const ex = c.exception
    if (!ex) return fail('saldo-pendiente', `La cuenta tiene un saldo pendiente de ${(balance / 100).toFixed(2)}. Completá el pago o registrá una excepción autorizada DEMO.`, { balance })
    if (ctx.actor !== 'encargado') return fail('no-autorizado', 'La excepción de cierre con saldo la autoriza el encargado (regla didáctica de la demo, no un permiso real).')
    const reason = (ex.reason ?? '').trim()
    if (!reason) return fail('motivo-requerido', 'La excepción necesita un motivo.')
    ses.closeException = { reason, authorizedBy: ctx.actor, pendingCents: balance, at: ctx.now }
    audit(s, ctx, ses.businessId, 'session.closedWithException', 'TableSession', ses.id, `Cierre con excepción DEMO: saldo ${balance / 100} sin cobrar. Motivo: ${reason}`)
  }
  ses.status = 'cerrada'
  ses.closedAt = ctx.now
  ses.version++
  for (const o of orders) {
    if (['servido', 'retirado'].includes(o.status)) {
      o.status = 'cerrado'
      o.version++
      const t = byId(s.tickets, o.ticketId)
      if (t) t.status = 'cerrado'
    }
  }
  if (ses.reservationId) {
    const r = byId(s.reservations, ses.reservationId)
    if (r && r.status === 'sentada') {
      r.status = 'completada'
      r.version++
    }
  }
  audit(s, ctx, ses.businessId, 'session.closed', 'TableSession', ses.id, `Cuenta ${ses.id} cerrada (simulado)`)
  emit(ctx, { type: 'session.closed', businessId: ses.businessId, entityType: 'TableSession', entityId: ses.id })
  return ok()
}

const cashClose: Handler = (s, c, ctx) => {
  const cs = byId(s.cashSessions, c.cashSessionId)
  if (!cs) return fail('caja-inexistente', 'Caja inexistente.')
  if (cs.status === 'cerrada') return dup()
  if (!Number.isInteger(c.countedCashCents) || c.countedCashCents < 0) return fail('importe-invalido', 'El efectivo contado debe ser un importe válido (centavos, no negativo).')
  const expected = expectedCash(s, cs)
  const diff = c.countedCashCents - expected
  const reason = (c.reason ?? '').trim()
  if (diff !== 0 && !reason) return fail('motivo-requerido', 'Hay una diferencia de arqueo: completá el motivo para cerrar el turno.', { expected, diff })
  cs.status = 'cerrada'
  cs.closedAt = ctx.now
  cs.countedCashCents = c.countedCashCents
  cs.expectedCashCents = expected
  cs.differenceCents = diff
  cs.closeReason = reason || null
  cs.version++
  audit(s, ctx, cs.businessId, 'cash.closed', 'CashSession', cs.id, `Caja ${cs.id} cerrada: esperado ${expected / 100}, contado ${c.countedCashCents / 100}, diferencia ${diff / 100}${reason ? ` (${reason})` : ''}`)
  return ok({ expected, diff })
}

export const cashHandlers: Record<string, Handler> = {
  'cash/open': cashOpen,
  'cash/movement': cashMovement,
  'cash/split': cashSplit,
  'pay/register': payRegister,
  'session/close': sessionClose,
  'cash/close': cashClose,
}
