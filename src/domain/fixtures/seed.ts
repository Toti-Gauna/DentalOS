import { processEvents } from '../automations'
import { applyCommand, type Command } from '../reducer'
import { atLocal } from '../time'
import type { AppState } from '../types'
import { baseState, customersService, emptySeed, tastingEvents } from './base'

export { emptySeed }

class Builder {
  constructor(public s: AppState) {}
  at(dateKey: string, hh: number, mm = 0) {
    this.s.clock.nowMs = atLocal(dateKey, hh * 60 + mm)
  }
  do(cmd: Command, allowFail = false) {
    const r = applyCommand(this.s, { actor: 'encargado', ...cmd })
    if (!r.outcome.ok && !allowFail) {
      throw new Error(`Seed: ${cmd.type} falló: ${r.outcome.message}`)
    }
    this.s = r.state
    return r.outcome
  }
  as(role: AppState['session']['role'], cmd: Command, allowFail = false) {
    return this.do({ ...cmd, actor: role }, allowFail)
  }
  setCustomer(businessId: 'mesa-clara' | 'ritual-cafe', id: string | null) {
    this.s.session.customerByBusiness[businessId] = id
  }
}

const SAT = '2026-10-17'
const MON = '2026-10-19'

/** Ciclo completo de un pedido ya enviado. */
function cycle(b: Builder, orderId: string, steps: { accept?: [number, number]; prepare?: [number, number]; ready?: [number, number]; deliver?: [number, number] }, day: string) {
  if (steps.accept) {
    b.at(day, ...steps.accept)
    b.as('recepcion', { type: 'order/accept', orderId })
  }
  if (steps.prepare) {
    b.at(day, ...steps.prepare)
    b.as('cocina', { type: 'order/prepare', orderId })
  }
  if (steps.ready) {
    b.at(day, ...steps.ready)
    b.as('cocina', { type: 'order/ready', orderId })
  }
  if (steps.deliver) {
    b.at(day, ...steps.deliver)
    b.as('mozo', { type: 'order/deliver', orderId })
  }
}

function mesaOrder(b: Builder, tableId: string, lines: { itemId: string; qty: number; selections?: Record<string, string[]> }[], alias: string) {
  for (const l of lines) b.do({ type: 'cart/add', businessId: 'mesa-clara', locationId: 'L-MC-salon', itemId: l.itemId, qty: l.qty, selections: l.selections ?? {} })
  b.do({ type: 'cart/setFulfillment', cartId: 'CART-L-MC-salon', fulfillment: { kind: 'mesa', tableId }, alias })
  const op = b.do({ type: 'cart/begin', cartId: 'CART-L-MC-salon' }).ok ? (b.s.carts.find((c) => c.id === 'CART-L-MC-salon')!.pendingOperationId as string) : ''
  const o = b.as('mozo', { type: 'order/submit', cartId: 'CART-L-MC-salon', operationId: op })
  return (o as any).data.orderId as string
}

function cafeOrder(
  b: Builder,
  locationId: string,
  customerId: string,
  alias: string,
  startMin: number,
  lines: { itemId: string; qty?: number; selections?: Record<string, string[]> }[],
) {
  b.setCustomer('ritual-cafe', customerId)
  const cartId = `CART-${locationId}`
  for (const l of lines) b.do({ type: 'cart/add', businessId: 'ritual-cafe', locationId, itemId: l.itemId, qty: l.qty ?? 1, selections: l.selections ?? {} })
  b.do({ type: 'cart/setFulfillment', cartId, fulfillment: { kind: 'retiro', startMin }, alias })
  b.do({ type: 'cart/begin', cartId })
  const op = b.s.carts.find((c) => c.id === cartId)!.pendingOperationId as string
  const o = b.as('cliente-recurrente', { type: 'order/submit', cartId, operationId: op })
  b.setCustomer('ritual-cafe', null)
  return (o as any).data.orderId as string
}

export function serviceSeed(): AppState {
  const b = new Builder(baseState('servicio'))
  b.s.customers = customersService()
  b.s.counters.CL = 8
  b.s.tastingEvents = tastingEvents()
  b.s.counters.E = 2

  // ---------------------------------------------------------------- jueves 15: hilos y reservas
  b.at('2026-10-15', 10, 0)
  b.do({ type: 'chat/new', businessId: 'mesa-clara', customerId: 'CL-001', channel: 'whatsapp' })
  b.do({ type: 'chat/new', businessId: 'mesa-clara', customerId: 'CL-002', channel: 'whatsapp' })
  b.do({ type: 'chat/new', businessId: 'ritual-cafe', customerId: 'CL-006', channel: 'whatsapp' })
  b.do({ type: 'chat/new', businessId: 'ritual-cafe', customerId: 'CL-007', channel: 'whatsapp' })

  const req = (n: number, o: Record<string, unknown>) =>
    b.as('recepcion', { type: 'res/request', businessId: 'mesa-clara', locationId: 'L-MC-salon', sectorPref: 'cualquiera', channel: 'recepcion', operationId: `seed-res-${n}`, ...o })
  const accept = (id: string) => b.as('recepcion', { type: 'res/accept', id })

  // R-001…R-008: cena del lunes 19 a las 20:00 en TODAS las mesas compatibles con cuatro (M5–M12)
  const dinner: [string, number][] = [['Familia Roldán', 4], ['Los Benítez', 4], ['Cumple de Sofi', 4], ['Mesa de la Vega', 4], ['Reunión Pereyra', 6], ['Amigos del club', 5], ['Familia Quiroga', 7], ['Cena de egresados', 8]]
  dinner.forEach(([alias, party], i) => {
    req(i + 1, { dateKey: MON, startMin: 20 * 60, party, alias })
    accept(`R-${String(i + 1).padStart(3, '0')}`)
  })
  // R-009: Bruno, 20:30 (confirmación por WhatsApp con FALLO de entrega para practicar el reintento)
  b.as('recepcion', { type: 'res/request', businessId: 'mesa-clara', locationId: 'L-MC-salon', dateKey: MON, startMin: 20 * 60 + 30, party: 2, alias: 'Bruno', customerId: 'CL-002', channel: 'whatsapp', conversationId: 'C-002', operationId: 'seed-res-9' })
  b.do({ type: 'rule/failNext', ruleId: 'RULE-AU02-mesa-clara', value: true })
  accept('R-009')
  // R-010: Bruno por chat (lunes 12:30), aceptada → confirmación entregada
  b.as('cliente-recurrente', { type: 'chat/send', conversationId: 'C-002', text: 'Hola' })
  b.as('cliente-recurrente', { type: 'chat/send', conversationId: 'C-002', text: 'Mesa para 2 el lunes a las 12:30' })
  b.as('cliente-recurrente', { type: 'chat/send', conversationId: 'C-002', text: 'Sí', payload: 'confirm' })
  accept('R-010')
  // R-011…R-018
  req(11, { dateKey: MON, startMin: 13 * 60, party: 4, alias: 'Equipo de oficina' })
  req(12, { dateKey: MON, startMin: 13 * 60 + 30, party: 3, alias: 'Marcos P.', dietaryNote: 'Alergia a las nueces' })
  req(13, { dateKey: MON, startMin: 21 * 60, party: 2, alias: 'Paula e hijos' })
  accept('R-013')
  req(14, { dateKey: '2026-10-20', startMin: 20 * 60, party: 4, alias: 'Los Giménez' })
  req(15, { dateKey: '2026-10-20', startMin: 20 * 60 + 30, party: 6, alias: 'Cumpleaños Vera' })
  b.as('recepcion', { type: 'res/offerAlternative', id: 'R-015', startMin: 21 * 60 })
  req(16, { dateKey: SAT, startMin: 20 * 60, party: 2, alias: 'Pareja Soler' })
  accept('R-016')
  req(17, { dateKey: SAT, startMin: 21 * 60, party: 4, alias: 'Grupo de teatro' })
  accept('R-017')
  req(18, { dateKey: SAT, startMin: 13 * 60, party: 3, alias: 'Familia Ledesma' })
  accept('R-018')
  b.as('recepcion', { type: 'wait/add', businessId: 'mesa-clara', locationId: 'L-MC-salon', dateKey: MON, startMin: 20 * 60, party: 4, alias: 'Familia Díaz', operationId: 'seed-wait-1' })

  // ---------------------------------------------------------------- sábado 17: servicio ya cerrado
  b.at(SAT, 11, 0)
  b.as('recepcion', { type: 'res/cancel', id: 'R-018', reason: 'Cambio de planes de la familia' })
  b.at(SAT, 11, 30)
  b.as('caja', { type: 'cash/open', businessId: 'mesa-clara', locationId: 'L-MC-salon', openingFloatCents: 3_000_000 })

  b.at(SAT, 13, 0)
  b.as('mozo', { type: 'salon/open', businessId: 'mesa-clara', locationId: 'L-MC-salon', tableIds: ['T-MC-03'], party: 2 })
  const o1 = mesaOrder(b, 'T-MC-03', [{ itemId: 'MC-12', qty: 2, selections: { 'MG-guarnicion': ['gu-papas-fritas'] } }], 'Mesa M3')
  cycle(b, o1, { accept: [13, 2], prepare: [13, 5], ready: [13, 25], deliver: [13, 28] }, SAT)
  const o2 = mesaOrder(b, 'T-MC-03', [{ itemId: 'MC-24', qty: 1 }, { itemId: 'MC-26', qty: 1 }], 'Mesa M3')
  cycle(b, o2, { accept: [13, 50], prepare: [13, 52], ready: [14, 0], deliver: [14, 3] }, SAT)

  b.at(SAT, 13, 30)
  b.as('mozo', { type: 'salon/open', businessId: 'mesa-clara', locationId: 'L-MC-salon', tableIds: ['T-MC-08'], party: 4 })
  const o3 = mesaOrder(b, 'T-MC-08', [{ itemId: 'MC-06', qty: 2, selections: { 'MG-salsa-pasta': ['sp-fileto'] } }], 'Mesa M8')
  const o4 = mesaOrder(b, 'T-MC-08', [{ itemId: 'MC-13', qty: 1, selections: { 'MG-guarnicion': ['gu-ensalada'] } }], 'Mesa M8')
  const o5 = mesaOrder(b, 'T-MC-08', [{ itemId: 'MC-01', qty: 1 }], 'Mesa M8')
  cycle(b, o3, { accept: [13, 40], prepare: [13, 44], ready: [14, 5], deliver: [14, 8] }, SAT)
  b.at(SAT, 13, 41)
  b.as('recepcion', { type: 'order/reject', orderId: o4, reason: 'Se terminó la milanesa napolitana' })
  b.at(SAT, 13, 42)
  b.as('recepcion', { type: 'order/accept', orderId: o5 })
  b.at(SAT, 13, 46)
  b.as('recepcion', { type: 'order/cancel', orderId: o5, reason: 'El cliente cambió de idea antes de preparar' })

  // pagos DEMO y cierres
  b.at(SAT, 14, 30)
  b.as('caja', { type: 'cash/split', sessionId: 'S-001', n: 2 })
  b.as('caja', { type: 'pay/register', sessionId: 'S-001', operationId: 'seed-pay-1', amountCents: 2_370_000, method: 'efectivo', shareIndex: 0 })
  b.as('caja', { type: 'pay/register', sessionId: 'S-001', operationId: 'seed-pay-2', amountCents: 2_370_000, method: 'tarjeta', shareIndex: 1 })
  b.as('caja', { type: 'session/close', sessionId: 'S-001' }, false)
  b.at(SAT, 14, 45)
  const total2 = b.s.orders.filter((o) => o.sessionId === 'S-002' && !['rechazado', 'cancelado'].includes(o.status)).reduce((a, o) => a + o.totalCents, 0)
  b.as('caja', { type: 'pay/register', sessionId: 'S-002', operationId: 'seed-pay-3', amountCents: total2, method: 'efectivo' })
  b.as('caja', { type: 'session/close', sessionId: 'S-002' })
  b.at(SAT, 15, 45)
  const cs1 = b.s.cashSessions.find((c) => c.id === 'CS-001')!
  const expected = cs1.openingFloatCents + b.s.payments.filter((p) => p.cashSessionId === 'CS-001' && p.method === 'efectivo').reduce((a, p) => a + p.amountCents, 0)
  b.as('encargado', { type: 'cash/close', cashSessionId: 'CS-001', countedCashCents: expected - 50_000, reason: 'Faltante de $ 500 en vuelto de la mañana' })

  b.at(SAT, 20, 5)
  b.as('recepcion', { type: 'res/arrive', id: 'R-016' })
  b.as('mozo', { type: 'salon/seat', reservationId: 'R-016' })
  b.at(SAT, 21, 40)
  b.as('caja', { type: 'session/close', sessionId: 'S-003' })
  b.at(SAT, 21, 50)
  b.as('recepcion', { type: 'res/noShow', id: 'R-017' })

  // ---------------------------------------------------------------- lunes 19, mañana en Ritual Café
  b.at(MON, 8, 0)
  b.as('caja', { type: 'cash/open', businessId: 'ritual-cafe', locationId: 'L-RC-centro', openingFloatCents: 2_000_000 })

  b.at(MON, 8, 10)
  const o6 = cafeOrder(b, 'L-RC-centro', 'CL-007', 'Lucía', 8 * 60 + 30, [
    { itemId: 'RC-04', selections: { 'MG-tamano': ['ta-mediano'], 'MG-leche': ['le-entera'] } },
    { itemId: 'RC-11' },
  ])
  cycle(b, o6, { accept: [8, 12], prepare: [8, 15], ready: [8, 28], deliver: [8, 35] }, MON)

  b.at(MON, 8, 40)
  const o7 = cafeOrder(b, 'L-RC-centro', 'CL-008', 'Tomás', 9 * 60, [{ itemId: 'RC-03', selections: { 'MG-leche': ['le-entera'] } }])
  cycle(b, o7, { accept: [8, 42], prepare: [8, 45], ready: [8, 55], deliver: [9, 2] }, MON)
  b.at(MON, 9, 5)
  const s7 = b.s.orders.find((o) => o.id === o7)!
  b.as('caja', { type: 'pay/register', sessionId: s7.sessionId, operationId: 'seed-pay-4', amountCents: s7.totalCents, method: 'efectivo' })
  b.as('caja', { type: 'session/close', sessionId: s7.sessionId })

  b.at(MON, 9, 20)
  const o8 = cafeOrder(b, 'L-RC-centro', 'CL-006', 'Ana', 10 * 60, [
    { itemId: 'RC-01', selections: { 'MG-origen': ['or-huila'] } },
    { itemId: 'RC-04', selections: { 'MG-tamano': ['ta-mediano'], 'MG-leche': ['le-vegetal'] } },
  ])
  cycle(b, o8, { accept: [9, 22], prepare: [9, 30] }, MON)
  b.at(MON, 9, 55)
  b.do({ type: 'rule/failNext', ruleId: 'RULE-AU05-ritual-cafe', value: true })
  b.as('cocina', { type: 'order/ready', orderId: o8 })

  b.at(MON, 9, 35)
  const o9 = cafeOrder(b, 'L-RC-centro', 'CL-007', 'Lucía', 10 * 60 + 15, [{ itemId: 'RC-07', selections: { 'MG-origen': ['or-guji'] } }])
  cycle(b, o9, { accept: [9, 40], prepare: [9, 50] }, MON)

  b.at(MON, 9, 45)
  const o10 = cafeOrder(b, 'L-RC-centro', 'CL-008', 'Tomás', 10 * 60 + 15, [{ itemId: 'RC-09', selections: { 'MG-tamano': ['ta-chico'] } }])
  cycle(b, o10, { accept: [9, 50] }, MON)

  b.at(MON, 9, 50)
  cafeOrder(b, 'L-RC-centro', 'CL-006', 'Ana', 10 * 60 + 30, [{ itemId: 'RC-05', selections: { 'MG-tamano': ['ta-chico'], 'MG-leche': ['le-vegetal'] } }])
  b.at(MON, 9, 55)
  cafeOrder(b, 'L-RC-norte', 'CL-007', 'Lucía', 10 * 60 + 30, [{ itemId: 'RC-01', selections: { 'MG-origen': ['or-cerrado'] } }])

  // ---------------------------------------------------------------- alertas iniciales de stock (2 bajos + 1 agotado)
  b.at(MON, 9, 58)
  for (const [type, id, bid] of [['stock.low', 'I-07', 'mesa-clara'], ['stock.low', 'I-13', 'ritual-cafe'], ['stock.out', 'I-14', 'ritual-cafe']] as const) {
    const ctx = { now: b.s.clock.nowMs, actor: 'sistema' as const, correlationId: 'COR-seed-stock', events: [{ type, businessId: bid, entityType: 'Ingredient', entityId: id }] }
    processEvents(b.s, ctx)
  }

  // ---------------------------------------------------------------- fidelización, pasaporte y catas
  b.at(MON, 9, 59)
  for (const d of ['2026-10-05', '2026-10-08', '2026-10-12', '2026-10-15']) {
    b.as('recepcion', { type: 'visit/credit', businessId: 'mesa-clara', locationId: 'L-MC-salon', customerId: 'CL-001', dateKey: d })
  }
  b.as('recepcion', { type: 'visit/credit', businessId: 'mesa-clara', locationId: 'L-MC-salon', customerId: 'CL-002', dateKey: '2026-10-14' })
  b.as('recepcion', { type: 'visit/credit', businessId: 'ritual-cafe', locationId: 'L-RC-centro', customerId: 'CL-006', dateKey: '2026-10-09' })
  b.as('recepcion', { type: 'visit/credit', businessId: 'ritual-cafe', locationId: 'L-RC-centro', customerId: 'CL-006', dateKey: '2026-10-16' })
  // una ejecución AU08 queda pendiente para practicar recuperación
  const lastAU08 = [...b.s.runs].reverse().find((r) => r.ruleCode === 'AU08')!
  lastAU08.status = 'pendiente'
  lastAU08.attempts = 0
  lastAU08.detail = 'En cola: pendiente de ejecutar.'
  b.setCustomer('mesa-clara', 'CL-001')
  b.as('cliente-recurrente', { type: 'pass/answer', businessId: 'mesa-clara', cardId: 'PB-ingrediente', optionId: 'a' })
  b.setCustomer('mesa-clara', null)

  const enroll = (n: number, eventId: string, customerId: string) =>
    b.as('recepcion', { type: 'event/enroll', eventId, customerId, operationId: `seed-eb-${n}` })
  ;['CL-002', 'CL-003', 'CL-004', 'CL-005'].forEach((c, i) => enroll(i + 1, 'E-001', c))
  enroll(5, 'E-002', 'CL-006')
  enroll(6, 'E-002', 'CL-007')

  // ---------------------------------------------------------------- historial de Lucía (café)
  b.as('cliente-recurrente', { type: 'chat/send', conversationId: 'C-004', text: 'Hola' })
  b.as('cliente-recurrente', { type: 'chat/send', conversationId: 'C-004', text: '¿Está libre de gluten el budín?' })

  // ---------------------------------------------------------------- estado final de arranque
  b.at(MON, 10, 0)
  b.s.session = {
    role: 'cliente-invitado',
    businessId: 'mesa-clara',
    locationByBusiness: { 'mesa-clara': 'L-MC-salon', 'ritual-cafe': 'L-RC-centro' },
    customerByBusiness: { 'mesa-clara': null, 'ritual-cafe': null },
  }
  b.s.carts = []
  return b.s
}
