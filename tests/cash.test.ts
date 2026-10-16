import { describe, expect, it } from 'vitest'
import { splitEqual, fmtARS } from '../src/domain/money'
import { sessionBalance } from '../src/domain/sessions'
import { expectedCash } from '../src/domain/cmd-cash'
import { validateState } from '../src/domain/validate'
import { T, MON } from './helpers'

const MC = { businessId: 'mesa-clara', locationId: 'L-MC-salon' }

/** Mesa con una cuenta de $10.000,00 exactos: dos ítems entregados. */
function cuenta10000(t: T) {
  t.at(MON, 12, 30)
  t.ok({ type: 'cash/open', ...MC, openingFloatCents: 1_000_000 })
  t.ok({ type: 'salon/open', ...MC, tableIds: ['T-MC-02'], party: 2 })
  // 7.200 (vigilante) + 2.800 (gaseosa ajustada a 2.800)
  t.ok({ type: 'menu/update', itemId: 'MC-27', patch: { priceCents: 280000 } })
  t.ok({ type: 'cart/add', ...MC, itemId: 'MC-24', qty: 1, selections: {} })
  t.ok({ type: 'cart/add', ...MC, itemId: 'MC-27', qty: 1, selections: {} })
  t.ok({ type: 'cart/setFulfillment', cartId: 'CART-L-MC-salon', fulfillment: { kind: 'mesa', tableId: 'T-MC-02' }, alias: 'M2' })
  const op = (t.ok({ type: 'cart/begin', cartId: 'CART-L-MC-salon' }) as any).data.operationId
  const oid = (t.ok({ type: 'order/submit', cartId: 'CART-L-MC-salon', operationId: op }) as any).data.orderId
  for (const c of ['accept', 'prepare', 'ready', 'deliver']) t.ok({ type: `order/${c}`, orderId: oid })
  return { oid, sid: t.get('orders', oid).sessionId as string }
}

describe('Caja (M07)', () => {
  it('S23: 10.000 ARS en 3 = 3.333,33 + 3.333,33 + 3.333,34; saldo cero; suma exacta', () => {
    const t = T.seed()
    const { sid } = cuenta10000(t)
    expect(t.get('tableSessions', sid) && sessionBalance(t.s, sid)).toBe(1_000_000)
    expect(splitEqual(1_000_000, 3)).toEqual([333333, 333333, 333334])
    const plan = t.ok({ type: 'cash/split', sessionId: sid, n: 3 }) as any
    expect(plan.data.shares).toEqual([333333, 333333, 333334])
    const pays = [0, 1, 2].map((i) => t.ok({ type: 'pay/register', sessionId: sid, operationId: `pay-${i}`, amountCents: plan.data.shares[i], method: 'efectivo', shareIndex: i }) as any)
    expect(pays.map((p) => p.data.balance)).toEqual([666667, 333334, 0])
    const rows = t.s.payments.filter((p) => p.sessionId === sid)
    expect(rows.reduce((a, p) => a + p.amountCents, 0)).toBe(1_000_000)
    expect(rows[2].adjustmentCents).toBe(1) // ajuste de centavo visible
    expect(fmtARS(333334)).toBe('$ 3.333,34')
    t.ok({ type: 'session/close', sessionId: sid })
    expect(t.get('tableSessions', sid).status).toBe('cerrada')
    expect(validateState(t.s)).toEqual([])
  })
  it('S23: partes inválidas, parte repetida y plan tras pagos', () => {
    const t = T.seed()
    const { sid } = cuenta10000(t)
    t.fail({ type: 'cash/split', sessionId: sid, n: 1 }, 'partes-invalidas')
    t.ok({ type: 'cash/split', sessionId: sid, n: 3 })
    t.fail({ type: 'pay/register', sessionId: sid, operationId: 'x1', amountCents: 333333, shareIndex: 2 }, 'importe-no-coincide')
    t.ok({ type: 'pay/register', sessionId: sid, operationId: 'x2', amountCents: 333333, shareIndex: 0 })
    t.fail({ type: 'pay/register', sessionId: sid, operationId: 'x3', amountCents: 333333, shareIndex: 0 }, 'parte-ya-pagada')
    t.fail({ type: 'cash/split', sessionId: sid, n: 2 }, 'ya-hay-pagos')
  })
  it('S24: reintentar el mismo pago no lo duplica ni reduce el saldo dos veces', () => {
    const t = T.seed()
    const { sid } = cuenta10000(t)
    t.ok({ type: 'pay/register', sessionId: sid, operationId: 'pay-1', amountCents: 400000, method: 'tarjeta' })
    const again = t.ok({ type: 'pay/register', sessionId: sid, operationId: 'pay-1', amountCents: 400000, method: 'tarjeta' }) as any
    expect(again.duplicate).toBe(true)
    expect(again.data.receiptNo).toMatch(/^DEMO-/)
    expect(sessionBalance(t.s, sid)).toBe(600000)
    expect(t.s.payments.filter((p) => p.sessionId === sid)).toHaveLength(1)
  })
  it('importes inválidos y sobrepago silencioso', () => {
    const t = T.seed()
    const { sid } = cuenta10000(t)
    t.fail({ type: 'pay/register', sessionId: sid, operationId: 'a', amountCents: 0 }, 'importe-invalido')
    t.fail({ type: 'pay/register', sessionId: sid, operationId: 'b', amountCents: -100 }, 'importe-invalido')
    t.fail({ type: 'pay/register', sessionId: sid, operationId: 'c', amountCents: 12.5 }, 'importe-invalido')
    t.fail({ type: 'pay/register', sessionId: sid, operationId: 'd', amountCents: 1_000_001 }, 'sobrepago')
    t.fail({ type: 'pay/register', sessionId: sid, operationId: 'e', amountCents: 100, method: 'cripto' }, 'medio-invalido')
  })
  it('pago por ítems: un ítem no se asigna dos veces y el importe debe coincidir', () => {
    const t = T.seed()
    const { oid, sid } = cuenta10000(t)
    const [l1, l2] = t.get('orders', oid).lines
    t.fail({ type: 'pay/register', sessionId: sid, operationId: 'i0', amountCents: 999, lineIds: [l1.id] }, 'importe-no-coincide')
    t.ok({ type: 'pay/register', sessionId: sid, operationId: 'i1', amountCents: l1.lineCents, lineIds: [l1.id] })
    t.fail({ type: 'pay/register', sessionId: sid, operationId: 'i2', amountCents: l1.lineCents, lineIds: [l1.id] }, 'linea-ya-asignada')
    t.ok({ type: 'pay/register', sessionId: sid, operationId: 'i3', amountCents: l2.lineCents, lineIds: [l2.id] })
    expect(sessionBalance(t.s, sid)).toBe(0)
  })
  it('sin caja abierta no se registran pagos', () => {
    const t = T.seed()
    t.at(MON, 12, 30)
    t.ok({ type: 'salon/open', ...MC, tableIds: ['T-MC-02'], party: 1 })
    t.ok({ type: 'cart/add', ...MC, itemId: 'MC-26', qty: 1, selections: {} })
    t.ok({ type: 'cart/setFulfillment', cartId: 'CART-L-MC-salon', fulfillment: { kind: 'mesa', tableId: 'T-MC-02' }, alias: 'M2' })
    const op = (t.ok({ type: 'cart/begin', cartId: 'CART-L-MC-salon' }) as any).data.operationId
    const o = t.ok({ type: 'order/submit', cartId: 'CART-L-MC-salon', operationId: op }) as any
    const sid = t.get('orders', o.data.orderId).sessionId
    t.fail({ type: 'pay/register', sessionId: sid, operationId: 'z', amountCents: 100 }, 'caja-cerrada')
  })
  it('S25: saldo pendiente bloquea el cierre; la excepción DEMO la autoriza el encargado y no simula cobro', () => {
    const t = T.seed()
    const { sid } = cuenta10000(t)
    t.ok({ type: 'pay/register', sessionId: sid, operationId: 'p1', amountCents: 400000 })
    const f = t.fail({ type: 'session/close', sessionId: sid }, 'saldo-pendiente') as any
    expect(f.data.balance).toBe(600000)
    expect(t.get('tableSessions', sid).status).toBe('activa')
    t.fail({ type: 'session/close', sessionId: sid, exception: { reason: 'Se retiró sin pagar' } }, 'no-autorizado', 'caja')
    t.fail({ type: 'session/close', sessionId: sid, exception: { reason: '  ' } }, 'motivo-requerido', 'encargado')
    t.ok({ type: 'session/close', sessionId: sid, exception: { reason: 'Cliente habitual; paga mañana (excepción DEMO)' } }, 'encargado')
    const ses = t.get('tableSessions', sid)
    expect(ses.status).toBe('cerrada')
    expect(ses.closeException).toMatchObject({ pendingCents: 600000, authorizedBy: 'encargado' })
    expect(t.s.payments.filter((p) => p.sessionId === sid)).toHaveLength(1) // no inventa un cobro
    expect(t.s.audit.some((a) => a.type === 'session.closedWithException')).toBe(true)
  })
  it('no se cierra una cuenta con pedidos sin entregar', () => {
    const t = T.seed()
    const { sid } = cuenta10000(t)
    t.ok({ type: 'cart/add', ...MC, itemId: 'MC-26', qty: 1, selections: {} })
    t.ok({ type: 'cart/setFulfillment', cartId: 'CART-L-MC-salon', fulfillment: { kind: 'mesa', tableId: 'T-MC-02' }, alias: 'M2' })
    const op = (t.ok({ type: 'cart/begin', cartId: 'CART-L-MC-salon' }) as any).data.operationId
    t.ok({ type: 'order/submit', cartId: 'CART-L-MC-salon', operationId: op })
    t.fail({ type: 'session/close', sessionId: sid }, 'pedidos-pendientes')
  })
  it('S26: arqueo distinto exige motivo; ventas, efectivo y diferencia quedan separados', () => {
    const t = T.seed()
    const { sid } = cuenta10000(t)
    t.ok({ type: 'pay/register', sessionId: sid, operationId: 'p1', amountCents: 600000, method: 'efectivo' })
    t.ok({ type: 'pay/register', sessionId: sid, operationId: 'p2', amountCents: 400000, method: 'tarjeta' })
    t.ok({ type: 'cash/movement', cashSessionId: 'CS-003', kind: 'egreso', amountCents: 50000, reason: 'Compra de hielo' })
    t.fail({ type: 'cash/movement', cashSessionId: 'CS-003', kind: 'egreso', amountCents: 90_000_000, reason: 'x' }, 'efectivo-insuficiente')
    t.fail({ type: 'cash/movement', cashSessionId: 'CS-003', kind: 'ingreso', amountCents: 0, reason: 'x' }, 'importe-invalido')
    const cs = t.get('cashSessions', 'CS-003')
    expect(expectedCash(t.s, cs)).toBe(1_000_000 + 600000 - 50000) // la tarjeta no es efectivo
    t.fail({ type: 'cash/close', cashSessionId: 'CS-003', countedCashCents: 1_500_000 }, 'motivo-requerido')
    t.fail({ type: 'cash/close', cashSessionId: 'CS-003', countedCashCents: -1, reason: 'x' }, 'importe-invalido')
    t.ok({ type: 'cash/close', cashSessionId: 'CS-003', countedCashCents: 1_500_000, reason: 'Billete roto' })
    expect(t.get('cashSessions', 'CS-003')).toMatchObject({ status: 'cerrada', expectedCashCents: 1_550_000, differenceCents: -50000, closeReason: 'Billete roto' })
    const again = t.ok({ type: 'cash/close', cashSessionId: 'CS-003', countedCashCents: 1 }) as any
    expect(again.duplicate).toBe(true)
  })
  it('una sola caja abierta por sede; fondo no negativo', () => {
    const t = T.seed()
    t.fail({ type: 'cash/open', businessId: 'ritual-cafe', locationId: 'L-RC-centro', openingFloatCents: 1 }, 'caja-abierta')
    t.fail({ type: 'cash/open', ...MC, openingFloatCents: -1 }, 'importe-invalido')
  })
})
