import { describe, expect, it } from 'vitest'
import { alternatives, freeSlots, slotAvailable } from '../src/domain/availability'
import { validateState } from '../src/domain/validate'
import { T, MON } from './helpers'

const base = { businessId: 'mesa-clara', locationId: 'L-MC-salon', sectorPref: 'cualquiera' }
const req = (o: Record<string, unknown>) => ({ type: 'res/request', ...base, channel: 'web', alias: 'Ana', ...o })

describe('Reservas y capacidad (M03)', () => {
  it('S11: 4 personas a las 21:30 se rechaza (solape) y propone 21:45; 21:45 se acepta', () => {
    const t = T.seed()
    const r = t.fail(req({ dateKey: MON, startMin: 21 * 60 + 30, party: 4, operationId: 'op-a' }), 'sin-cupo') as any
    expect(r.data.alternatives[0]).toBe(21 * 60 + 45)
    expect(r.data.alternatives).not.toContain(21 * 60 + 30)
    expect(t.count('reservations')).toBe(18) // borrador: no se creó reserva
    const q = { businessId: 'mesa-clara', locationId: 'L-MC-salon', dateKey: MON, party: 4, sectorPref: 'cualquiera' as const }
    expect(slotAvailable(t.s, { ...q, startMin: 20 * 60 })).toBe(false)
    expect(slotAvailable(t.s, { ...q, startMin: 21 * 60 + 30 })).toBe(false)
    expect(slotAvailable(t.s, { ...q, startMin: 21 * 60 + 45 })).toBe(true) // intervalo semiabierto
    t.ok(req({ dateKey: MON, startMin: 21 * 60 + 45, party: 4, operationId: 'op-b' }))
    expect(t.get('reservations', 'R-019').status).toBe('solicitada')
  })
  it('el fixture bloquea TODAS las alternativas compatibles de cuatro a las 20:00 (no una sola mesa)', () => {
    const t = T.seed()
    expect(freeSlots(t.s, { businessId: 'mesa-clara', locationId: 'L-MC-salon', dateKey: MON, party: 4, sectorPref: 'cualquiera' }).filter((m) => m < 21 * 60 + 45 && m >= 20 * 60)).toEqual([])
    // pero una mesa de 2 sí tiene cupo a las 20:00
    expect(slotAvailable(t.s, { businessId: 'mesa-clara', locationId: 'L-MC-salon', dateKey: MON, party: 2, startMin: 20 * 60, sectorPref: 'cualquiera' })).toBe(true)
  })
  it('alternativas: nunca ofrecen franjas cerradas', () => {
    const t = T.seed()
    const alts = alternatives(t.s, { businessId: 'mesa-clara', locationId: 'L-MC-salon', dateKey: MON, party: 4, startMin: 20 * 60 }, 6)
    for (const m of alts) expect(m >= 20 * 60 && m + 90 <= 23 * 60 + 30).toBe(true)
    t.fail(req({ dateKey: MON, startMin: 18 * 60, party: 2, operationId: 'op-c' }), 'fuera-de-horario')
    t.fail(req({ dateKey: '2026-10-25', startMin: 12 * 60, party: 2, operationId: 'op-d' }), 'fuera-de-horario') // domingo
    t.fail(req({ dateKey: MON, startMin: 9 * 60, party: 2, operationId: 'op-e' }), 'fecha-pasada')
    t.fail(req({ dateKey: '2026-10-20', startMin: 9 * 60, party: 2, operationId: 'op-e2' }), 'fuera-de-horario')
    t.fail(req({ dateKey: '2026-10-17', startMin: 20 * 60, party: 2, operationId: 'op-f' }), 'fecha-pasada')
  })
  it('solicitud idempotente por operationId (doble clic)', () => {
    const t = T.seed()
    t.ok(req({ dateKey: MON, startMin: 21 * 60 + 45, party: 4, operationId: 'op-dd' }))
    const again = t.ok(req({ dateKey: MON, startMin: 21 * 60 + 45, party: 4, operationId: 'op-dd' })) as any
    expect(again.duplicate).toBe(true)
    expect(t.count('reservations')).toBe(19)
  })
  it('S12: recepción acepta R-019 y asigna mesa; versión y audit', () => {
    const t = T.seed()
    t.ok(req({ dateKey: MON, startMin: 21 * 60 + 45, party: 4, operationId: 'op-g' }))
    const v = t.get('reservations', 'R-019').version
    t.ok({ type: 'res/accept', id: 'R-019', expectedVersion: v }, 'recepcion')
    const r = t.get('reservations', 'R-019')
    expect(r.status).toBe('confirmada')
    expect(r.tableId).toBeTruthy()
    expect(r.version).toBe(v + 1)
    expect(t.s.audit.some((a) => a.type === 'reservation.confirmed' && a.entityId === 'R-019')).toBe(true)
    const again = t.ok({ type: 'res/accept', id: 'R-019' }) as any
    expect(again.duplicate).toBe(true)
  })
  it('S12 (error): otro evento ocupó la mesa → revalida y ofrece alternativa', () => {
    const t = T.seed()
    // dos solicitudes para el último cupo de 21:45 con party 8: solo hay 2 mesas de 8
    for (let i = 0; i < 3; i++) t.ok(req({ dateKey: MON, startMin: 21 * 60 + 45, party: 8, operationId: `op-${i}`, alias: `G${i}` }))
    t.ok({ type: 'res/accept', id: 'R-019' })
    t.ok({ type: 'res/accept', id: 'R-020' })
    const r = t.fail({ type: 'res/accept', id: 'R-021' }, 'sin-disponibilidad') as any
    expect(t.get('reservations', 'R-021').status).toBe('solicitada')
    expect(Array.isArray(r.data.alternatives)).toBe(true)
    const alt = r.data.alternatives[0] as number
    expect(alt).toBeGreaterThanOrEqual(12 * 60)
    t.fail({ type: 'res/offerAlternative', id: 'R-021', startMin: 22 * 60 }, 'sin-disponibilidad')
    t.ok({ type: 'res/offerAlternative', id: 'R-021', startMin: alt }, 'recepcion')
    expect(t.get('reservations', 'R-021').status).toBe('alternativa_ofrecida')
    t.ok({ type: 'res/acceptAlternative', id: 'R-021' })
    expect(t.get('reservations', 'R-021')).toMatchObject({ status: 'confirmada', startMin: alt })
    expect(validateState(t.s)).toEqual([])
  })
  it('S13: reprogramar a un horario ocupado conserva el original (sin cambios parciales)', () => {
    const t = T.seed()
    // otra reserva ocupa la mesa M5 más tarde: 22:00 (se asigna a la mesa de 4 que quede libre)
    t.ok(req({ dateKey: MON, startMin: 22 * 60, party: 4, operationId: 'op-s13', alias: 'Tarde' }))
    t.ok({ type: 'res/accept', id: 'R-019' })
    expect(t.get('reservations', 'R-019').tableId).toBe('T-MC-05')
    const before = t.get('reservations', 'R-001')
    const snapshot = JSON.stringify(before)
    const r = t.fail({ type: 'res/reschedule', id: 'R-001', startMin: 21 * 60 + 30 }, 'sin-disponibilidad') as any
    expect(r.message).toMatch(/original/)
    expect(JSON.stringify(t.get('reservations', 'R-001'))).toBe(snapshot)
    t.ok({ type: 'res/reschedule', id: 'R-001', startMin: 20 * 60 + 15 }) // su propia mesa sigue libre
    expect(t.get('reservations', 'R-001')).toMatchObject({ startMin: 20 * 60 + 15, version: before.version + 1 })
    expect(t.run({ type: 'res/reschedule', id: 'R-001', startMin: 20 * 60 + 15 })).toMatchObject({ ok: true, duplicate: true })
    expect(validateState(t.s)).toEqual([])
  })
  it('reprogramar valida el nuevo recurso antes de liberar el original', () => {
    const t = T.seed()
    // R-001 → 20:00 de otra fecha cualquiera libre
    t.ok({ type: 'res/reschedule', id: 'R-001', dateKey: '2026-10-21', startMin: 20 * 60 })
    expect(t.get('reservations', 'R-001').dateKey).toBe('2026-10-21')
    // la mesa original quedó libre el lunes 19: un 4 puede entrar de nuevo
    expect(slotAvailable(t.s, { businessId: 'mesa-clara', locationId: 'L-MC-salon', dateKey: MON, party: 4, startMin: 20 * 60, sectorPref: 'cualquiera' })).toBe(true)
  })
  it('S14: cancelar dos veces libera el cupo una sola vez', () => {
    const t = T.seed()
    t.fail({ type: 'res/cancel', id: 'R-001', reason: '' }, 'motivo-requerido')
    t.ok({ type: 'res/cancel', id: 'R-001', reason: 'Cambio de planes' })
    expect(t.get('reservations', 'R-001')).toMatchObject({ status: 'cancelada', tableId: null })
    const again = t.ok({ type: 'res/cancel', id: 'R-001', reason: 'Cambio de planes' }) as any
    expect(again.duplicate).toBe(true)
    expect(t.s.audit.filter((a) => a.type === 'reservation.cancelled' && a.entityId === 'R-001')).toHaveLength(1)
    const free = freeSlots(t.s, { businessId: 'mesa-clara', locationId: 'L-MC-salon', dateKey: MON, party: 4, sectorPref: 'cualquiera' }).includes(20 * 60)
    expect(free).toBe(true) // se liberó una mesa de 4, no más
    // solo una mesa quedó libre: dos grupos de cuatro no caben a las 20:00
    t.ok({ type: 'wait/cancel', id: 'W-001' }) // evita la oferta automática en este caso
    t.ok(req({ dateKey: MON, startMin: 20 * 60, party: 4, operationId: 'op-h', alias: 'H1' }))
    t.ok({ type: 'res/accept', id: 'R-019' })
    t.fail(req({ dateKey: MON, startMin: 20 * 60, party: 4, operationId: 'op-i', alias: 'H2' }), 'sin-cupo')
  })
  it('S15: perfil sin reservas no crea Reservation y explica la política', () => {
    const t = T.seed()
    const r = t.fail({ type: 'res/request', businessId: 'ritual-cafe', locationId: 'L-RC-centro', dateKey: MON, startMin: 11 * 60, party: 2, alias: 'Ana', channel: 'web', operationId: 'op-j' }, 'sin-reservas')
    expect(r.ok === false && r.message).toMatch(/orden de llegada/)
    expect(t.count('reservations')).toBe(18)
    t.fail({ type: 'wait/add', businessId: 'ritual-cafe', locationId: 'L-RC-centro', dateKey: MON, startMin: 11 * 60, party: 2, alias: 'Ana', operationId: 'op-k' }, 'sin-reservas')
  })
  it('S16: grupo de 16 → revisión humana, sin mesa de 8 asignada', () => {
    const t = T.seed()
    t.ok(req({ dateKey: '2026-10-22', startMin: 21 * 60, party: 16, operationId: 'op-l' }))
    const r = t.get('reservations', 'R-019')
    expect(r).toMatchObject({ status: 'revision_humana', tableId: null, reviewReason: 'grupo-grande' })
    expect(t.s.tasks.some((x) => x.entityId === 'R-019' && x.kind === 'grupo-grande' && x.status === 'pendiente')).toBe(true)
    t.fail({ type: 'res/accept', id: 'R-019' }, 'revision-pendiente')
    expect(t.get('reservations', 'R-019').tableId).toBeNull()
  })
  it('alergia en la solicitud bloquea la aceptación automática hasta la revisión (S35)', () => {
    const t = T.seed()
    t.ok({ type: 'config/set', businessId: 'mesa-clara', patch: { autoConfirmReservations: true } })
    t.ok(req({ dateKey: '2026-10-21', startMin: 20 * 60, party: 2, operationId: 'op-m', dietaryNote: 'Alergia a frutos secos' }))
    expect(t.get('reservations', 'R-019')).toMatchObject({ status: 'revision_humana', tableId: null })
    t.fail({ type: 'res/accept', id: 'R-019' }, 'revision-pendiente')
    t.fail({ type: 'res/resolveReview', id: 'R-019', note: '' }, 'motivo-requerido')
    t.ok({ type: 'res/resolveReview', id: 'R-019', note: 'Se confirmó con cocina' })
    t.ok({ type: 'res/accept', id: 'R-019' })
    expect(t.get('reservations', 'R-019').status).toBe('confirmada')
    // una reserva sin alergia y con auto-confirmación queda confirmada
    t.ok(req({ dateKey: '2026-10-21', startMin: 20 * 60, party: 2, operationId: 'op-n' }))
    expect(t.get('reservations', 'R-020').status).toBe('confirmada')
  })
})

describe('Salón (M04)', () => {
  const seat = (t: T) => {
    t.at(MON, 12, 25)
    t.ok({ type: 'res/arrive', id: 'R-010' })
    return t.ok({ type: 'salon/seat', reservationId: 'R-010' }) as any
  }
  it('S17: sentar una reserva abre una sesión enlazada; una sola sesión activa por mesa', () => {
    const t = T.seed()
    const r = seat(t)
    const ses = t.get('tableSessions', r.data.sessionId)
    expect(ses).toMatchObject({ status: 'activa', reservationId: 'R-010' })
    expect(t.get('reservations', 'R-010')).toMatchObject({ status: 'sentada', sessionId: ses.id })
    const busyTable = ses.tableIds[0]
    const e = t.fail({ type: 'salon/open', businessId: 'mesa-clara', locationId: 'L-MC-salon', tableIds: [busyTable], party: 2 }, 'mesa-ocupada')
    expect(e.ok === false && e.message).toMatch(/ocupada|sesión activa/)
    expect(validateState(t.s)).toEqual([])
  })
  it('S18: mover a una mesa ocupada se bloquea; mover a libre conserva cuenta e ítems', () => {
    const t = T.seed()
    t.at(MON, 12, 25)
    t.ok({ type: 'salon/open', businessId: 'mesa-clara', locationId: 'L-MC-salon', tableIds: ['T-MC-02'], party: 2 })
    t.ok({ type: 'salon/open', businessId: 'mesa-clara', locationId: 'L-MC-salon', tableIds: ['T-MC-03'], party: 2 })
    t.ok({ type: 'cart/add', businessId: 'mesa-clara', locationId: 'L-MC-salon', itemId: 'MC-01', qty: 1, selections: {} })
    t.ok({ type: 'cart/setFulfillment', cartId: 'CART-L-MC-salon', fulfillment: { kind: 'mesa', tableId: 'T-MC-02' }, alias: 'M2' })
    const op = (t.ok({ type: 'cart/begin', cartId: 'CART-L-MC-salon' }) as any).data.operationId
    const oid = (t.ok({ type: 'order/submit', cartId: 'CART-L-MC-salon', operationId: op }) as any).data.orderId
    const sid = t.get('orders', oid).sessionId
    const lines = JSON.stringify(t.get('orders', oid).lines)
    t.fail({ type: 'salon/move', sessionId: sid, tableId: 'T-MC-03' }, 'mesa-ocupada')
    expect(t.get('tableSessions', sid).tableIds).toEqual(['T-MC-02'])
    t.ok({ type: 'salon/move', sessionId: sid, tableId: 'T-MC-04' })
    expect(t.get('tableSessions', sid).tableIds).toEqual(['T-MC-04'])
    expect(JSON.stringify(t.get('orders', oid).lines)).toBe(lines)
    expect(t.get('orders', oid).sessionId).toBe(sid)
  })
  it('combinación de mesas solo bajo la regla de muestra', () => {
    const t = T.seed()
    t.at(MON, 12, 25)
    t.fail({ type: 'salon/open', businessId: 'mesa-clara', locationId: 'L-MC-salon', tableIds: ['T-MC-01', 'T-MC-03'], party: 4 }, 'combinacion-no-permitida')
    t.fail({ type: 'salon/open', businessId: 'mesa-clara', locationId: 'L-MC-salon', tableIds: ['T-MC-01', 'T-MC-02'], party: 5 }, 'capacidad')
    t.ok({ type: 'salon/open', businessId: 'mesa-clara', locationId: 'L-MC-salon', tableIds: ['T-MC-01', 'T-MC-02'], party: 4 })
    t.fail({ type: 'salon/open', businessId: 'mesa-clara', locationId: 'L-MC-salon', tableIds: ['T-MC-02'], party: 2 }, 'mesa-ocupada')
  })
  it('lista de espera: la cancelación ofrece al primer candidato, vence por reloj y no confirma sola (AU04)', () => {
    const t = T.seed()
    expect(t.get('waitlist', 'W-001').status).toBe('esperando')
    t.ok({ type: 'res/cancel', id: 'R-001', reason: 'Se cae la reunión' })
    expect(t.get('waitlist', 'W-001')).toMatchObject({ status: 'ofrecida', offerStartMin: 1200 })
    expect(t.count('reservations')).toBe(18) // no se confirma sola
    t.ok({ type: 'clock/advance', minutes: 31 })
    expect(t.get('waitlist', 'W-001').status).toBe('vencida')
    // otra vez: nueva espera + cancelación + validación del equipo
    t.ok({ type: 'wait/add', businessId: 'mesa-clara', locationId: 'L-MC-salon', dateKey: MON, startMin: 1200, party: 4, alias: 'Familia Díaz', operationId: 'op-w2' })
    t.ok({ type: 'res/cancel', id: 'R-002', reason: 'Imprevisto' })
    const w = t.s.waitlist.find((x) => x.status === 'ofrecida')!
    const ok = t.ok({ type: 'wait/confirm', id: w.id }, 'recepcion') as any
    expect(t.get('reservations', ok.data.reservationId).status).toBe('confirmada')
    expect(t.get('waitlist', w.id).status).toBe('aceptada')
    expect(validateState(t.s)).toEqual([])
  })
  it('oferta retirada si otra reserva ocupa el cupo (no se confirman dos grupos en la misma mesa)', () => {
    const t = T.seed()
    t.ok({ type: 'res/cancel', id: 'R-001', reason: 'x' })
    expect(t.get('waitlist', 'W-001').status).toBe('ofrecida')
    // otro grupo toma la única mesa libre antes de la validación del equipo
    t.ok({ type: 'res/request', ...base, channel: 'recepcion', alias: 'Walk', dateKey: MON, startMin: 1200, party: 4, operationId: 'op-z' })
    t.ok({ type: 'res/accept', id: 'R-019' })
    expect(t.get('waitlist', 'W-001').status).toBe('retirada')
    t.fail({ type: 'wait/confirm', id: 'W-001' }, undefined)
  })
})
