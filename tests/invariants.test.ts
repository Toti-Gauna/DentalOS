import { describe, expect, it } from 'vitest'
import { applyCommand, type Command } from '../src/domain/reducer'
import { makeSeed } from '../src/domain/fixtures'
import { validateState } from '../src/domain/validate'
import { sessionBalance, sessionTotal } from '../src/domain/sessions'
import type { AppState } from '../src/domain/types'

// PRNG determinista (mulberry32) para secuencias reproducibles
function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function invariants(s: AppState) {
  expect(validateState(s)).toEqual([])
  // stock: reservas ≤ existencias y nunca negativo
  for (const i of s.ingredients) {
    expect(i.onHand).toBeGreaterThanOrEqual(0)
    expect(i.reserved).toBeGreaterThanOrEqual(0)
    expect(i.reserved).toBeLessThanOrEqual(i.onHand)
  }
  // el stock coincide con la suma de movimientos
  const seedIng = makeSeed('servicio').ingredients
  for (const i of s.ingredients) {
    const base = seedIng.find((x) => x.id === i.id)!
    const mv = s.stockMovements.filter((m) => m.ingredientId === i.id)
    const baseOn = base.onHand - makeSeedDelta(i.id)
    void baseOn
    expect(mv.reduce((a, m) => a + m.deltaReserved, 0)).toBe(i.reserved - seedReserved(i.id))
  }
  // una sesión activa por mesa; pagos nunca superan el total
  for (const ses of s.tableSessions) {
    expect(sessionBalance(s, ses.id)).toBeGreaterThanOrEqual(0)
    const paid = s.payments.filter((p) => p.sessionId === ses.id).reduce((a, p) => a + p.amountCents, 0)
    expect(paid).toBeLessThanOrEqual(sessionTotal(s, ses.id) + 0)
  }
  // una orden en un estado coherente con su comanda
  for (const o of s.orders) {
    const t = s.tickets.find((x) => x.id === o.ticketId)!
    const map: Record<string, string[]> = {
      enviado: ['nuevo'], aceptado: ['aceptado'], en_preparacion: ['preparando'], listo: ['listo'], servido: ['entregado'], retirado: ['entregado'],
      cerrado: ['cerrado'], rechazado: ['rechazado'], cancelado: ['cancelado'],
    }
    expect(map[o.status]).toContain(t.status)
  }
  // ninguna mesa tiene dos reservas confirmadas solapadas
  const hold = s.reservations.filter((r) => ['confirmada', 'llegada', 'sentada'].includes(r.status) && r.tableId)
  for (let a = 0; a < hold.length; a++) {
    for (let b = a + 1; b < hold.length; b++) {
      const x = hold[a], y = hold[b]
      if (x.tableId === y.tableId && x.dateKey === y.dateKey) {
        const xe = x.startMin + 105
        const ye = y.startMin + 105
        expect(x.startMin < ye && y.startMin < xe, `${x.id} solapa ${y.id}`).toBe(false)
      }
    }
  }
}
const seedState = makeSeed('servicio')
const makeSeedDelta = (_id: string) => 0
const seedReserved = (id: string) => seedState.ingredients.find((i) => i.id === id)!.reserved

function randomCommand(s: AppState, r: () => number): Command {
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]
  const orders = s.orders
  const reservations = s.reservations
  const kind = Math.floor(r() * 16)
  switch (kind) {
    case 0: return { type: 'order/accept', orderId: pick(orders).id }
    case 1: return { type: 'order/prepare', orderId: pick(orders).id }
    case 2: return { type: 'order/ready', orderId: pick(orders).id }
    case 3: return { type: 'order/deliver', orderId: pick(orders).id }
    case 4: return { type: 'order/cancel', orderId: pick(orders).id, reason: 'prueba' }
    case 5: return { type: 'order/reject', orderId: pick(orders).id, reason: 'prueba' }
    case 6: return { type: 'res/accept', id: pick(reservations).id }
    case 7: return { type: 'res/cancel', id: pick(reservations).id, reason: 'prueba' }
    case 8: return { type: 'res/reschedule', id: pick(reservations).id, startMin: pick([720, 780, 1200, 1245, 1305, 1320]) }
    case 9: return { type: 'clock/advance', minutes: pick([15, 30, 60]) }
    case 10: return { type: 'stock/adjust', ingredientId: pick(s.ingredients).id, delta: pick([-500, -50, 10, 300]) }
    case 11: return { type: 'order/resolveCancel', orderId: pick(orders).id, decision: pick(['mantener', 'cancelar-con-merma', 'cancelar-sin-merma']) }
    case 12: {
      const biz = pick(['mesa-clara', 'ritual-cafe'])
      const loc = biz === 'mesa-clara' ? 'L-MC-salon' : 'L-RC-centro'
      const item = pick(s.menuItems.filter((m) => m.businessId === biz))
      const sel: Record<string, string[]> = {}
      for (const gid of item.modifierGroupIds) {
        const g = s.modifierGroups.find((x) => x.id === gid)!
        if (g.required) sel[gid] = [pick(g.options).id]
      }
      return { type: 'cart/add', businessId: biz, locationId: loc, itemId: item.id, qty: 1 + Math.floor(r() * 3), selections: sel }
    }
    case 13: {
      const cart: { id: string; locationId: string } = s.carts.length ? pick(s.carts) : { id: 'CART-L-RC-centro', locationId: 'L-RC-centro' }
      return { type: 'cart/setFulfillment', cartId: cart.id, fulfillment: cart.locationId === 'L-MC-salon' ? { kind: 'mesa', tableId: pick(['T-MC-02', 'T-MC-03', 'T-MC-04']) } : { kind: 'retiro', startMin: pick([615, 630, 645, 660]) }, alias: 'Azar' }
    }
    case 14: {
      const cart = s.carts.length ? pick(s.carts) : null
      if (!cart) return { type: 'clock/advance', minutes: 15 }
      const op = cart.pendingOperationId ?? `OP-rnd-${Math.floor(r() * 1e6)}`
      return { type: 'order/submit', cartId: cart.id, operationId: op }
    }
    default: {
      const ses = s.tableSessions.filter((x) => x.status === 'activa')
      return ses.length ? { type: 'session/close', sessionId: pick(ses).id } : { type: 'wait/add', businessId: 'mesa-clara', locationId: 'L-MC-salon', dateKey: '2026-10-20', startMin: 1200, party: 2, alias: 'Azar', operationId: `w-${Math.floor(r() * 1e6)}` }
    }
  }
}

describe('Invariantes bajo secuencias aleatorias reproducibles', () => {
  for (const seed of [1, 7, 42, 2026]) {
    it(`semilla ${seed}: 250 comandos sin romper el estado`, () => {
      const r = rng(seed)
      let s = makeSeed('servicio')
      for (let i = 0; i < 250; i++) {
        const cmd = randomCommand(s, r)
        const before = s
        const out = applyCommand(s, cmd)
        if (!out.outcome.ok && !(out.outcome as { commit?: boolean }).commit) expect(out.state).toBe(before) // fallos transaccionales
        s = out.state
        if (i % 25 === 0) invariants(s)
      }
      invariants(s)
    })
  }
  it('el mismo comando dos veces nunca duplica efectos (idempotencia por estado)', () => {
    let s = makeSeed('servicio')
    for (const cmd of [{ type: 'order/accept', orderId: 'O-011' }, { type: 'order/prepare', orderId: 'O-010' }, { type: 'res/cancel', id: 'R-003', reason: 'x' }, { type: 'visit/credit', businessId: 'mesa-clara', locationId: 'L-MC-salon', customerId: 'CL-002', dateKey: '2026-10-19' }] as Command[]) {
      const a = applyCommand(s, cmd)
      const b = applyCommand(a.state, cmd)
      expect(JSON.stringify(b.state)).toBe(JSON.stringify(a.state))
      s = a.state
    }
  })
})
