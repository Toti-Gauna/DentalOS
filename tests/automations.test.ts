import { describe, expect, it } from 'vitest'
import { previewRuleText } from '../src/domain/automations'
import { validateState } from '../src/domain/validate'
import { T, MON } from './helpers'

const MC = { businessId: 'mesa-clara', locationId: 'L-MC-salon' }
const RC = { businessId: 'ritual-cafe', locationId: 'L-RC-centro' }
const runs = (t: T, code: string, entityId?: string) => t.s.runs.filter((r) => r.ruleCode === code && (!entityId || r.entityId === entityId))
const rule = (code: string, b = 'mesa-clara') => `RULE-${code}-${b}`

function webReservation(t: T, op = 'w1', extra: Record<string, unknown> = {}) {
  return t.ok({ type: 'res/request', ...MC, dateKey: '2026-10-21', startMin: 21 * 60, party: 2, alias: 'Ana', customerId: 'CL-001', conversationId: 'C-001', channel: 'whatsapp', operationId: op, sectorPref: 'cualquiera', ...extra }) as any
}

describe('Automatizaciones AU01–AU10 (M12)', () => {
  it('AU01 éxito: una solicitud = una ejecución enlazada al hilo; doble clic no duplica', () => {
    const t = T.seed()
    webReservation(t)
    webReservation(t) // mismo operationId
    expect(runs(t, 'AU01', 'R-019')).toHaveLength(1)
    expect(runs(t, 'AU01', 'R-019')[0]).toMatchObject({ status: 'ejecutada' })
    expect(runs(t, 'AU01', 'R-019')[0].detail).toMatch(/C-001/)
    expect(runs(t, 'AU01', 'R-019')[0].log.length).toBeGreaterThan(0)
  })
  it('AU01 sin cupo: no hay solicitud ni ejecución; pausa: se omite con audit', () => {
    const t = T.seed()
    const n0 = runs(t, 'AU01').length
    t.fail({ type: 'res/request', ...MC, dateKey: MON, startMin: 21 * 60 + 30, party: 4, alias: 'Ana', channel: 'whatsapp', operationId: 'x' }, 'sin-cupo')
    expect(runs(t, 'AU01')).toHaveLength(n0)
    t.ok({ type: 'rule/toggle', ruleId: rule('AU01'), enabled: false })
    webReservation(t, 'w2')
    expect(runs(t, 'AU01', 'R-019')).toHaveLength(0)
    expect(t.s.audit.some((a) => a.type === 'automation.skipped')).toBe(true)
    expect(t.get('reservations', 'R-019')).toBeTruthy() // pausar la regla no bloquea la solicitud
  })
  it('AU02 éxito, error inyectado y reintento sobre la MISMA ejecución (un solo mensaje)', () => {
    const t = T.seed()
    webReservation(t)
    t.ok({ type: 'rule/failNext', ruleId: rule('AU02'), value: true })
    t.ok({ type: 'res/accept', id: 'R-019' })
    const [run] = runs(t, 'AU02', 'R-019')
    expect(run.status).toBe('fallida')
    expect(t.get('messages', run.messageId as string).status).toBe('fallido')
    t.ok({ type: 'run/retry', runId: run.id })
    const after = t.get('runs', run.id)
    expect(after.status).toBe('recuperada')
    expect(after.attempts).toBe(2)
    expect(t.s.messages.filter((m) => m.messageKey === run.key)).toHaveLength(1)
    expect(t.get('messages', run.messageId as string).status).toBe('enviado')
    expect((t.ok({ type: 'run/retry', runId: run.id }) as any).duplicate).toBe(true)
    expect(runs(t, 'AU02', 'R-019')).toHaveLength(1)
  })
  it('AU02 reintento que vuelve a fallar queda fallida; el log lo muestra', () => {
    const t = T.seed()
    const run = t.get('runs', 'RUN-0010') // del seed: AU02 de R-009 fallida
    expect(run.status).toBe('fallida')
    t.ok({ type: 'rule/failNext', ruleId: rule('AU02'), value: true })
    t.ok({ type: 'run/retry', runId: run.id })
    expect(t.get('runs', run.id).status).toBe('fallida')
    t.ok({ type: 'run/retry', runId: run.id })
    expect(t.get('runs', run.id).status).toBe('recuperada')
    expect(t.get('runs', run.id).log.map((l: any) => l.text).join('|')).toMatch(/enviado/)
  })
  it('AU02 teléfono desconocido deriva; sin consentimiento no envía', () => {
    const t = T.seed()
    t.ok({ type: 'res/request', ...MC, dateKey: '2026-10-21', startMin: 20 * 60, party: 2, alias: 'Equipo de oficina', customerId: 'CL-003', channel: 'web', operationId: 'dd', sectorPref: 'cualquiera' })
    t.ok({ type: 'res/accept', id: 'R-019' })
    expect(runs(t, 'AU02', 'R-019')[0].status).toBe('derivada')
    expect(t.s.tasks.some((x) => x.kind === 'canal-desconocido' && x.entityId === 'R-019')).toBe(true)
    t.ok({ type: 'cust/consent', customerId: 'CL-001', service: false })
    webReservation(t, 'w3')
    t.ok({ type: 'res/accept', id: 'R-020' })
    expect(runs(t, 'AU02', 'R-020')[0].status).toBe('omitida')
    expect(t.s.messages.filter((m) => m.conversationId === 'C-001' && m.from === 'sistema')).toHaveLength(0)
  })
  it('AU02 reprogramar: nueva versión ⇒ nueva confirmación (una por versión)', () => {
    const t = T.seed()
    webReservation(t)
    t.ok({ type: 'res/accept', id: 'R-019' })
    t.ok({ type: 'res/reschedule', id: 'R-019', startMin: 21 * 60 + 30 })
    expect(runs(t, 'AU02', 'R-019')).toHaveLength(2)
    expect(t.s.messages.filter((m) => m.conversationId === 'C-001' && m.from === 'sistema' && /reprogramada/.test(m.text))).toHaveLength(1)
  })
  it('AU03 / S36: avanzar el reloj dos veces envía UNA sola entrega; fallo → reintento sin duplicar', () => {
    const t = T.seed()
    // R-010 (Bruno, 12:30) → recordatorio a las 10:30
    t.ok({ type: 'clock/advance', minutes: 20 })
    expect(runs(t, 'AU03')).toHaveLength(0)
    t.ok({ type: 'rule/failNext', ruleId: rule('AU03'), value: true })
    t.ok({ type: 'clock/advance', minutes: 15 })
    let r = runs(t, 'AU03', 'R-010')
    expect(r).toHaveLength(1)
    expect(r[0].status).toBe('fallida')
    t.ok({ type: 'clock/advance', minutes: 15 })
    expect(runs(t, 'AU03', 'R-010')).toHaveLength(1) // reloj repetido no reenvía
    t.ok({ type: 'run/retry', runId: r[0].id })
    r = runs(t, 'AU03', 'R-010')
    expect(r[0].status).toBe('recuperada')
    const msgs = t.s.messages.filter((m) => m.messageKey === r[0].key)
    expect(msgs).toHaveLength(1)
    expect(msgs[0].actions.map((a) => a.label)).toEqual(['Confirmar asistencia', 'Cancelar reserva'])
    // silencio no cancela: la reserva sigue confirmada
    expect(t.get('reservations', 'R-010').status).toBe('confirmada')
  })
  it('AU03: la reserva reprogramada anula el recordatorio viejo; cancelada o sin consentimiento suprime', () => {
    const t = T.seed()
    t.ok({ type: 'rule/failNext', ruleId: rule('AU03'), value: true })
    t.ok({ type: 'clock/advance', minutes: 35 })
    const old = runs(t, 'AU03', 'R-010')[0]
    expect(old.status).toBe('fallida')
    t.ok({ type: 'res/reschedule', id: 'R-010', startMin: 13 * 60 })
    expect(t.get('runs', old.id).status).toBe('suprimida')
    expect(t.get('runs', old.id).detail).toMatch(/Reemplazada/)
    // la nueva versión (13:00) recién cruza T−2h a las 11:00: entonces se genera otro recordatorio, único
    expect(runs(t, 'AU03', 'R-010').filter((r) => r.status !== 'suprimida')).toHaveLength(0)
    t.ok({ type: 'clock/advance', minutes: 30 })
    t.ok({ type: 'clock/advance', minutes: 5 })
    expect(runs(t, 'AU03', 'R-010').filter((r) => r.status !== 'suprimida')).toHaveLength(1)
    // baja de servicio
    const t2 = T.seed()
    t2.ok({ type: 'cust/consent', customerId: 'CL-002', service: false })
    t2.ok({ type: 'clock/advance', minutes: 35 })
    expect(runs(t2, 'AU03', 'R-010')[0].status).toBe('omitida')
    // cancelada antes: no se genera
    const t3 = T.seed()
    t3.ok({ type: 'res/cancel', id: 'R-010', reason: 'x' })
    t3.ok({ type: 'clock/advance', minutes: 35 })
    expect(runs(t3, 'AU03', 'R-010')).toHaveLength(0)
  })
  it('AU03: confirmar asistencia desde el mensaje es visible en recepción', () => {
    const t = T.seed()
    t.ok({ type: 'clock/advance', minutes: 35 })
    t.ok({ type: 'chat/send', conversationId: 'C-002', text: 'Confirmar asistencia', payload: 'attend:R-010' }, 'cliente-recurrente')
    expect(t.get('reservations', 'R-010').attendanceConfirmed).toBe(true)
  })
  it('AU04 oferta a la lista de espera: éxito (primer candidato), pausa y vencimiento', () => {
    const t = T.seed()
    t.ok({ type: 'rule/toggle', ruleId: rule('AU04'), enabled: false })
    t.ok({ type: 'res/cancel', id: 'R-001', reason: 'x' })
    expect(t.get('waitlist', 'W-001').status).toBe('esperando') // regla pausada: no ofrece
    t.ok({ type: 'rule/toggle', ruleId: rule('AU04'), enabled: true })
    t.ok({ type: 'res/cancel', id: 'R-002', reason: 'x' })
    expect(t.get('waitlist', 'W-001').status).toBe('ofrecida')
    expect(runs(t, 'AU04', 'W-001')).toHaveLength(1)
    expect(runs(t, 'AU04', 'W-001')[0].detail).toMatch(/vence en 30 min/)
  })
  it('AU05 aviso de listo: sin canal muestra el código; con canal, un mensaje; error conserva "listo" y reintenta', () => {
    const t = T.seed()
    // O-006 (Lucía sin WhatsApp) ya salió: código en pantalla
    const sinCanal = runs(t, 'AU05', 'O-006')[0]
    expect(sinCanal.detail).toMatch(/código 006 en pantalla/)
    // O-008 (Ana con WhatsApp) quedó con fallo en el seed
    const fail = runs(t, 'AU05', 'O-008')[0]
    expect(fail.status).toBe('fallida')
    expect(t.get('orders', 'O-008').status).toBe('listo')
    t.ok({ type: 'run/retry', runId: fail.id })
    expect(t.get('runs', fail.id).status).toBe('recuperada')
    expect(t.s.messages.filter((m) => m.messageKey === fail.key)).toHaveLength(1)
    // el pedido muestra un solo evento de aviso
    expect(runs(t, 'AU05', 'O-008')).toHaveLength(1)
    expect(t.get('orders', 'O-008').noticeRunId).toBe(fail.id)
  })
  it('AU06 stock: alerta única por cruce, ítems pausados y reposición no duplica', () => {
    const t = T.seed()
    const roll = runs(t, 'AU06', 'I-14')[0]
    expect(roll.detail).toMatch(/Roll de canela/)
    t.ok({ type: 'stock/restock', ingredientId: 'I-14', qty: 10 })
    t.ok({ type: 'stock/restock', ingredientId: 'I-14', qty: 5 })
    expect(runs(t, 'AU06', 'I-14')).toHaveLength(1)
    // nuevo cruce (epoch distinto) = nueva alerta
    const have = t.get('ingredients', 'I-14').onHand
    t.ok({ type: 'stock/adjust', ingredientId: 'I-14', delta: -have })
    expect(runs(t, 'AU06', 'I-14')).toHaveLength(2)
  })
  it('AU06 pausa de la regla: igual no se vende lo agotado', () => {
    const t = T.seed()
    t.ok({ type: 'rule/toggle', ruleId: rule('AU06', 'ritual-cafe'), enabled: false })
    const before = runs(t, 'AU06').length
    const have = t.get('ingredients', 'I-15').onHand
    t.ok({ type: 'stock/adjust', ingredientId: 'I-15', delta: -have })
    expect(runs(t, 'AU06')).toHaveLength(before)
    t.fail({ type: 'cart/add', ...RC, itemId: 'RC-11', qty: 1, selections: {} }, 'item-no-disponible')
  })
  it('AU07 revisión humana: tarea ligada al hilo, sin aceptación automática (consentimiento no aplica)', () => {
    const t = T.seed()
    t.ok({ type: 'chat/send', conversationId: 'C-001', text: 'Tengo alergia a la lactosa' })
    const r = runs(t, 'AU07')
    expect(r.length).toBeGreaterThan(0)
    expect(t.s.tasks.find((x) => x.entityId === 'C-001')!.conversationId).toBe('C-001')
    // pausar AU07 no impide la tarea humana (seguridad), sí el registro de la ejecución
    const t2 = T.seed()
    t2.ok({ type: 'rule/toggle', ruleId: rule('AU07'), enabled: false })
    t2.ok({ type: 'chat/send', conversationId: 'C-001', text: 'Soy celíaca' })
    expect(t2.s.tasks.some((x) => x.entityId === 'C-001')).toBe(true)
  })
  it('AU08 sello único por fecha: repetido no suma; pausa; log', () => {
    const t = T.seed()
    const pend = t.s.runs.filter((r) => r.ruleCode === 'AU08' && r.status === 'pendiente')
    expect(pend).toHaveLength(1)
    t.ok({ type: 'run/retry', runId: pend[0].id })
    expect(t.get('runs', pend[0].id).status).toBe('ejecutada')
    const r1 = t.ok({ type: 'visit/credit', ...MC, customerId: 'CL-001', dateKey: MON }, 'recepcion') as any
    expect(r1.data.stamps).toBe(5)
    expect(r1.data.badge).toBe(true) // insignia a la quinta
    const r2 = t.ok({ type: 'visit/credit', ...MC, customerId: 'CL-001', dateKey: MON }, 'recepcion') as any
    expect(r2.duplicate).toBe(true)
    expect(runs(t, 'AU08').filter((r) => r.detail.includes('Insignia')).length).toBe(1)
  })
  it('AU09 cata: cancelación libera un lugar y ofrece al siguiente; vence por reloj', () => {
    const t = T.seed()
    // Ana toma el último lugar (cupo 0) y otra persona queda en espera
    t.ok({ type: 'event/enroll', eventId: 'E-001', customerId: 'CL-001', operationId: 'e1' })
    t.fail({ type: 'event/enroll', eventId: 'E-001', alias: 'Valeria', operationId: 'e2' }, 'cupo-lleno')
    const w = t.ok({ type: 'event/enroll', eventId: 'E-001', alias: 'Valeria', operationId: 'e3', joinWaitlist: true }) as any
    expect(t.get('eventBookings', w.data.bookingId).status).toBe('espera')
    const first = t.s.eventBookings.find((b) => b.customerId === 'CL-002' && b.eventId === 'E-001')!
    t.ok({ type: 'event/cancel', bookingId: first.id })
    expect(t.get('eventBookings', w.data.bookingId).status).toBe('oferta')
    expect(runs(t, 'AU09')).toHaveLength(1)
    t.ok({ type: 'clock/advance', minutes: 61 })
    expect(t.get('eventBookings', w.data.bookingId).status).toBe('vencida')
    t.fail({ type: 'event/acceptOffer', bookingId: w.data.bookingId }, 'sin-oferta')
  })
  it('AU10 campaña: solo vista previa, omite sin consentimiento promo y registra la omisión (S37)', () => {
    const t = T.seed()
    const r = t.ok({ type: 'campaign/preview', businessId: 'mesa-clara' }) as any
    expect(r.data.excluded).toEqual(expect.arrayContaining(['Bruno', 'Equipo de oficina']))
    expect(r.data.included).toEqual(expect.arrayContaining(['Ana']))
    expect(t.s.audit.filter((a) => a.type === 'campaign.skipped').length).toBe(r.data.excluded.length)
    expect(t.s.messages.filter((m) => /promo/i.test(m.text))).toHaveLength(0) // ningún mensaje saliente
    expect(t.s.campaignPreviews).toHaveLength(1)
    // baja posterior: los futuros previews suprimen
    t.ok({ type: 'cust/consent', customerId: 'CL-001', promo: false })
    const r2 = t.ok({ type: 'campaign/preview', businessId: 'mesa-clara' }) as any
    expect(r2.data.included).not.toContain('Ana')
    // servicio y promoción son independientes
    expect(t.get('customers', 'CL-001').consent).toMatchObject({ service: true, promo: false })
    t.ok({ type: 'rule/toggle', ruleId: rule('AU10'), enabled: false })
    t.fail({ type: 'campaign/preview', businessId: 'mesa-clara' }, 'regla-pausada')
  })
  it('las reglas se previsualizan sin efectos y la configuración versiona la regla', () => {
    const t = T.seed()
    const r = t.get('rules', rule('AU03'))
    const before = JSON.stringify(t.s)
    expect(previewRuleText(t.s, r)).toMatch(/T−2 h/)
    expect(JSON.stringify(t.s)).toBe(before)
    t.fail({ type: 'rule/config', ruleId: rule('AU03'), patch: { leadHours: 0 } }, 'validacion')
    t.ok({ type: 'rule/config', ruleId: rule('AU03'), patch: { leadHours: 3 } })
    expect(t.get('rules', rule('AU03')).version).toBe(2)
    expect(validateState(t.s)).toEqual([])
  })
})
