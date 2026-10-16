import { describe, expect, it } from 'vitest'
import { buildReport } from '../src/domain/reports'
import { validateState } from '../src/domain/validate'
import { T, MON } from './helpers'
import { stampsOf, passportDone } from '../src/domain/cmd-engage'

const MC = { businessId: 'mesa-clara', locationId: 'L-MC-salon' }

describe('Pasaporte, fidelización, catas y reportes (M10, M13, M14, M15)', () => {
  it('S38: tres tarjetas, error sin penalización, insignia sin comprar, guardar selección', () => {
    const t = T.seed()
    t.ok({ type: 'session/setRole', role: 'cliente-invitado' })
    const biz = 'ritual-cafe'
    const bad = t.ok({ type: 'pass/answer', businessId: biz, cardId: 'PC-metodo', optionId: 'b' }) as any
    expect(bad.data.correct).toBe(false)
    expect(bad.data.explanation).toMatch(/papel/)
    const pass = () => t.s.passports.find((p) => p.businessId === biz && p.customerId === null)!
    expect(pass().cards['PC-metodo'].done).toBe(false)
    expect(pass().cards['PC-metodo'].attempts).toBe(1)
    t.ok({ type: 'pass/answer', businessId: biz, cardId: 'PC-metodo', optionId: 'a' })
    expect((t.ok({ type: 'pass/answer', businessId: biz, cardId: 'PC-metodo', optionId: 'a' }) as any).duplicate).toBe(true) // cuenta una sola vez
    t.ok({ type: 'pass/read', businessId: biz, cardId: 'PC-origen' }) // leída sin responder
    t.fail({ type: 'pass/save', businessId: biz, itemId: 'RC-07' }, 'insignia-no-disponible')
    t.ok({ type: 'pass/answer', businessId: biz, cardId: 'PC-perfil', optionId: 'b' })
    expect(pass().badge).toBe('disponible')
    expect(pass().metrics).toMatchObject({ started: 1, completed: 1 })
    t.fail({ type: 'pass/save', businessId: biz, itemId: 'XX' }, 'seleccion-invalida')
    t.ok({ type: 'pass/save', businessId: biz, itemId: 'RC-07' })
    expect(pass()).toMatchObject({ badge: 'guardada', savedPreference: 'RC-07' })
    expect(t.s.orders.length).toBe(12) // logro sin comprar
    // la selección guardada se usa en el carrito (métrica local)
    t.ok({ type: 'cart/add', businessId: biz, locationId: 'L-RC-centro', itemId: 'RC-07', qty: 1, selections: { 'MG-origen': ['or-huila'] } })
    expect(pass().metrics.usedInCart).toBe(1)
    t.ok({ type: 'pass/reset', businessId: biz })
    expect(pass()).toMatchObject({ badge: 'reiniciada', savedPreference: null })
    expect(passportDone(t.s, pass())).toBe(0)
    // pausar la mecánica no rompe la carta
    t.ok({ type: 'pass/pause', businessId: biz, paused: true })
    t.fail({ type: 'pass/answer', businessId: biz, cardId: 'PC-metodo', optionId: 'a' }, 'mecanica-pausada')
  })
  it('S39: el sello es único por persona y fecha; la reversión pide motivo y conserva el historial', () => {
    const t = T.seed()
    expect(stampsOf(t.s, 'CL-001')).toBe(4)
    const a = t.ok({ type: 'visit/credit', ...MC, customerId: 'CL-001', dateKey: MON }, 'recepcion') as any
    expect(a.data.stamps).toBe(5)
    expect((t.ok({ type: 'visit/credit', ...MC, customerId: 'CL-001', dateKey: MON }, 'recepcion') as any).duplicate).toBe(true)
    expect(stampsOf(t.s, 'CL-001')).toBe(5)
    t.fail({ type: 'visit/revert', visitId: a.data.visitId, reason: '' }, 'motivo-requerido')
    t.ok({ type: 'visit/revert', visitId: a.data.visitId, reason: 'Se acreditó por error' })
    expect(stampsOf(t.s, 'CL-001')).toBe(4)
    expect(t.get('visits', a.data.visitId)).toMatchObject({ status: 'revertida', reversalReason: 'Se acreditó por error' })
    expect((t.ok({ type: 'visit/revert', visitId: a.data.visitId, reason: 'otra vez' }) as any).duplicate).toBe(true)
    expect(t.count('redemptions')).toBe(0) // no hay premios reales
    expect(t.get('businesses', 'mesa-clara').rewardsEnabled).toBe(false)
  })
  it('S39: criterio conservador entre sedes: un sello por persona y fecha en todo el negocio', () => {
    const t = T.seed()
    t.ok({ type: 'visit/credit', businessId: 'ritual-cafe', locationId: 'L-RC-centro', customerId: 'CL-006', dateKey: MON })
    t.fail({ type: 'visit/credit', businessId: 'ritual-cafe', locationId: 'L-RC-norte', customerId: 'CL-006', dateKey: MON }, 'sello-diario')
  })
  it('S40: inscripción única por cliente/cata, cupo 0 → espera, cancelar libera exactamente un lugar', () => {
    const t = T.seed()
    const seats = () => t.s.eventBookings.filter((b) => b.eventId === 'E-001' && ['inscripto', 'oferta'].includes(b.status)).length
    expect(seats()).toBe(4) // capacidad 5
    const a = t.ok({ type: 'event/enroll', eventId: 'E-001', customerId: 'CL-001', operationId: 'ea' }) as any
    expect(seats()).toBe(5)
    const again = t.ok({ type: 'event/enroll', eventId: 'E-001', customerId: 'CL-001', operationId: 'eb' }) as any
    expect(again.duplicate).toBe(true)
    expect(seats()).toBe(5)
    t.fail({ type: 'event/enroll', eventId: 'E-001', alias: 'Nuevo', operationId: 'ec' }, 'cupo-lleno')
    t.ok({ type: 'event/cancel', bookingId: a.data.bookingId })
    expect(seats()).toBe(4)
    expect((t.ok({ type: 'event/cancel', bookingId: a.data.bookingId }) as any).duplicate).toBe(true)
    expect(seats()).toBe(4) // libera una sola vez
    t.ok({ type: 'event/enroll', eventId: 'E-001', alias: 'Nuevo', operationId: 'ed' })
    expect(seats()).toBe(5)
    expect(validateState(t.s)).toEqual([])
  })
  it('un cliente no se duplica por cambiar de canal; unir duplicados exige confirmación local', () => {
    const t = T.seed()
    t.ok({ type: 'res/request', ...MC, dateKey: '2026-10-21', startMin: 20 * 60, party: 2, alias: 'Valeria', channel: 'web', operationId: 'v1', sectorPref: 'cualquiera' })
    const n = t.s.customers.length
    t.ok({ type: 'res/request', ...MC, dateKey: '2026-10-22', startMin: 20 * 60, party: 2, alias: 'valeria', channel: 'whatsapp', operationId: 'v2', sectorPref: 'cualquiera' })
    expect(t.s.customers).toHaveLength(n)
    // unir Marcos P. (CL-004) con Marcos Pérez (CL-005)
    t.fail({ type: 'cust/merge', keepId: 'CL-005', dropId: 'CL-004' }, 'confirmacion-requerida')
    t.fail({ type: 'cust/merge', keepId: 'CL-005', dropId: 'CL-006', confirm: true }, 'negocio-distinto')
    const resOf4 = t.s.reservations.filter((r) => r.customerId === 'CL-004').length
    t.ok({ type: 'cust/merge', keepId: 'CL-005', dropId: 'CL-004', confirm: true })
    expect(t.get('customers', 'CL-004').mergedInto).toBe('CL-005')
    expect(t.s.reservations.filter((r) => r.customerId === 'CL-005').length).toBeGreaterThanOrEqual(resOf4)
    expect(t.s.reservations.some((r) => r.customerId === 'CL-004')).toBe(false)
    expect(validateState(t.s)).toEqual([])
  })
  it('consentimientos de servicio y promoción se tratan por separado', () => {
    const t = T.seed()
    t.ok({ type: 'cust/consent', customerId: 'CL-002', promo: true })
    expect(t.get('customers', 'CL-002').consent).toMatchObject({ service: true, promo: true })
    t.ok({ type: 'cust/consent', customerId: 'CL-002', service: false })
    expect(t.get('customers', 'CL-002').consent).toMatchObject({ service: false, promo: true })
    expect((t.ok({ type: 'cust/consent', customerId: 'CL-002', service: false }) as any).duplicate).toBe(true)
  })
  it('S41: tablero derivado de pedidos/caja/stock; filtro sin actividad → vacío, sin ingresos inventados', () => {
    const t = T.seed()
    const base = { businessId: 'ritual-cafe' as const, locationId: 'todas' as const, channel: 'todos' as const }
    const hoy = buildReport(t.s, { ...base, from: MON, to: MON })
    expect(hoy.empty).toBe(false)
    expect(hoy.orders.count).toBe(7)
    expect(hoy.orders.salesCents).toBe(880000 + 510000) // retirado + cerrado
    expect(hoy.cash.sessions[0].id).toBe('CS-002')
    expect(hoy.profit).toBeNull()
    const vacio = buildReport(t.s, { ...base, from: '2026-11-02', to: '2026-11-03' })
    expect(vacio.empty).toBe(true)
    expect(vacio.orders.salesCents).toBe(0)
    expect(vacio.cash.collectedCents).toBe(0)
    // cambiar un pedido modifica los indicadores
    t.ok({ type: 'order/accept', orderId: 'O-011' })
    t.ok({ type: 'order/prepare', orderId: 'O-011' })
    t.ok({ type: 'order/ready', orderId: 'O-011' })
    t.ok({ type: 'order/deliver', orderId: 'O-011' })
    const despues = buildReport(t.s, { ...base, from: MON, to: MON })
    expect(despues.orders.salesCents).toBe(hoy.orders.salesCents + 660000)
    // sede + canal
    const norte = buildReport(t.s, { ...base, locationId: 'L-RC-norte', from: MON, to: MON })
    expect(norte.orders.count).toBe(1)
    const wa = buildReport(t.s, { ...base, channel: 'whatsapp', from: MON, to: MON })
    expect(wa.orders.count).toBe(0)
  })
})
