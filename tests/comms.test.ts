import { describe, expect, it } from 'vitest'
import { validateState } from '../src/domain/validate'
import { T, MON } from './helpers'

const say = (t: T, conversationId: string, text: string, payload?: string) => t.ok({ type: 'chat/send', conversationId, text, payload }, 'cliente-recurrente')
const last = (t: T, cid: string, n = 1) => t.s.messages.filter((m) => m.conversationId === cid && m.from === 'asistente').slice(-n).map((m) => m.text)
const lastMsg = (t: T, cid: string) => [...t.s.messages].reverse().find((m) => m.conversationId === cid && m.from === 'asistente')!
const msgs = (t: T, cid: string) => t.s.messages.filter((m) => m.conversationId === cid)

describe('WhatsApp simulado: guion determinista (M11)', () => {
  it('S27: Hola / Buenas / holaa → saludo con opciones; sin reserva ni API', () => {
    for (const hi of ['Hola', 'Buenas', 'holaa', 'Buen día']) {
      const t = T.seed()
      say(t, 'C-001', hi)
      expect(last(t, 'C-001')[0]).toBe('Hola, soy el asistente de Mesa Clara en esta demo. ¿Querés reservar, consultar la carta o seguir un pedido?')
      expect(lastMsg(t, 'C-001').actions.map((a) => a.label)).toEqual(['Reservar', 'Ver la carta', 'Seguir un pedido'])
      expect(t.count('reservations')).toBe(18)
    }
  })
  it('S28: vacío o solo espacios no crea burbuja ni evento', () => {
    const t = T.seed()
    const m0 = t.count('messages')
    const a0 = t.count('audit')
    for (const txt of ['', '   ', '\n\t ']) t.fail({ type: 'chat/send', conversationId: 'C-001', text: txt }, 'vacio')
    expect(t.count('messages')).toBe(m0)
    expect(t.count('audit')).toBe(a0)
  })
  it('guion 2→4: mesa para 4 el lunes a las 20 → alternativa 21:45 → resumen → solicitud R-019', () => {
    const t = T.seed()
    say(t, 'C-001', 'Hola')
    say(t, 'C-001', 'Mesa para 4 el lunes a las 20')
    expect(last(t, 'C-001')[0]).toBe('En el día simulado no hay mesa de cuatro a las 20:00. Puedo ofrecer 21:45, según la disponibilidad de muestra')
    expect(lastMsg(t, 'C-001').actions.map((a) => a.label)).toContain('21:45')
    say(t, 'C-001', '21:45', 'alt:1305')
    expect(last(t, 'C-001')[0]).toBe('Serían 4 personas el lunes 19 a las 21:45, salón. Tu preferencia no garantiza sector. ¿Confirmás la solicitud?')
    expect(t.count('reservations')).toBe(18) // todavía no hay registro
    say(t, 'C-001', 'Confirmar solicitud', 'confirm')
    const r = t.get('reservations', 'R-019')
    expect(r).toMatchObject({ status: 'solicitada', party: 4, startMin: 21 * 60 + 45, conversationId: 'C-001', channel: 'whatsapp' })
    expect(last(t, 'C-001')[0]).toMatch(/Solicitud recibida; el equipo todavía debe confirmarla\. Folio: R-019/)
    expect(lastMsg(t, 'C-001').link).toEqual({ label: 'Ver mi reserva', to: '/mesa-clara/reservas/R-019' })
    expect(r.status).not.toBe('confirmada') // una solicitud no se rotula confirmada antes de la aceptación
    // doble confirmación: no duplica
    say(t, 'C-001', 'Confirmar solicitud', 'confirm')
    expect(t.count('reservations')).toBe(19)
  })
  it('S12/S34: al aceptar R-019 el chat recibe la confirmación; cliente y admin ven el mismo estado', () => {
    const t = T.seed()
    say(t, 'C-001', 'Mesa para 4 el lunes a las 20')
    say(t, 'C-001', '21:45')
    say(t, 'C-001', 'sí')
    t.ok({ type: 'res/accept', id: 'R-019' }, 'recepcion')
    const conf = msgs(t, 'C-001').filter((m) => m.from === 'sistema')
    expect(conf).toHaveLength(1)
    expect(conf[0].text).toMatch(/Tu reserva fue confirmada: R-019/)
    expect(conf[0].status).toBe('enviado')
    expect(t.get('reservations', 'R-019').status).toBe('confirmada')
    expect(t.s.runs.filter((r) => r.ruleCode === 'AU02' && r.entityId === 'R-019')).toHaveLength(1)
  })
  it('fecha ambigua pide confirmación antes de seguir', () => {
    const t = T.seed()
    say(t, 'C-001', 'Mesa para 2 el 27 a las 21')
    expect(last(t, 'C-001')[0]).toMatch(/¿Te referís al .* 27 de octubre\?/)
    expect(t.count('reservations')).toBe(18)
    say(t, 'C-001', 'Sí', 'confirm')
    expect(last(t, 'C-001')[0]).toMatch(/Serían 2 personas el .* 27 a las 21:00/)
    say(t, 'C-001', 'a las pronto')
    const t2 = T.seed()
    say(t2, 'C-001', 'Quiero una mesa el finde')
    expect(last(t2, 'C-001')[0]).toMatch(/¿Para cuántas personas\?/)
    say(t2, 'C-001', 'somos 3')
    expect(last(t2, 'C-001')[0]).toBe('¿Para qué día?')
  })
  it('S35: alergia en el chat → derivación, revisión humana y sin garantía; bloquea la aceptación', () => {
    const t = T.seed()
    say(t, 'C-001', 'Mesa para 4 el lunes a las 20')
    say(t, 'C-001', '21:45')
    say(t, 'C-001', 'sí')
    say(t, 'C-001', 'Tengo alergia a frutos secos')
    expect(last(t, 'C-001')[0]).toMatch(/^Voy a derivar tu consulta al equipo para que confirme ingredientes y preparación\. Esta demo no puede garantizar ausencia de alérgenos/)
    const r = t.get('reservations', 'R-019')
    expect(r).toMatchObject({ status: 'revision_humana', reviewReason: 'alimentaria', tableId: null })
    expect(t.s.tasks.some((x) => x.kind === 'alimentaria' && x.entityId === 'R-019')).toBe(true)
    expect(t.s.runs.some((x) => x.ruleCode === 'AU07')).toBe(true)
    t.fail({ type: 'res/accept', id: 'R-019' }, 'revision-pendiente', 'recepcion')
    expect(last(t, 'C-001')[0]).not.toMatch(/sin alérgenos|es seguro|podés comer/i)
  })
  it('gluten: informa la anotación de muestra y deriva seguridad alimentaria', () => {
    const t = T.seed()
    say(t, 'C-001', '¿Está libre de gluten?')
    expect(last(t, 'C-001')[0]).toMatch(/anotación alimentaria/)
    expect(last(t, 'C-001')[0]).toMatch(/no puede garantizar ausencia de alérgenos/)
    expect(t.s.tasks.some((x) => x.kind === 'alimentaria' && x.entityId === 'C-001')).toBe(true)
  })
  it('guion 6: cancelar busca la reserva enlazada, confirma, libera y deja historial', () => {
    const t = T.seed()
    say(t, 'C-001', 'Mesa para 2 el lunes a las 21')
    say(t, 'C-001', 'sí')
    t.ok({ type: 'res/accept', id: 'R-019' })
    say(t, 'C-001', 'Quiero cancelar')
    expect(last(t, 'C-001')[0]).toMatch(/Encontré R-019 .*¿Confirmás que la cancele\?/)
    expect(t.get('reservations', 'R-019').status).toBe('confirmada') // todavía no
    say(t, 'C-001', 'Sí, cancelar', 'confirm')
    expect(t.get('reservations', 'R-019')).toMatchObject({ status: 'cancelada', tableId: null })
    expect(t.s.audit.filter((a) => a.type === 'reservation.cancelled' && a.entityId === 'R-019')).toHaveLength(1)
  })
  it('guion 6 (dos reservas): pregunta cuál y no cancela ambas; S30 el mismo nombre pide folio', () => {
    const t = T.seed()
    for (const [time, op] of [['20', 'a'], ['21', 'b']]) {
      say(t, 'C-001', `Mesa para 2 el martes a las ${time}`)
      say(t, 'C-001', 'sí')
      void op
    }
    expect(t.get('reservations', 'R-019')).toBeTruthy()
    expect(t.get('reservations', 'R-020')).toBeTruthy()
    say(t, 'C-001', 'Quiero cancelar')
    expect(last(t, 'C-001')[0]).toMatch(/Tenés 2 reservas activas.*¿Cuál cancelo\?/)
    expect(t.s.reservations.filter((r) => r.status === 'cancelada' && r.id > 'R-018' && r.id !== 'R-018')).toHaveLength(0)
    say(t, 'C-001', 'la R-020')
    say(t, 'C-001', 'sí', 'confirm')
    expect(t.get('reservations', 'R-020').status).toBe('cancelada')
    expect(t.get('reservations', 'R-019').status).toBe('solicitada')
  })
  it('S30: cambiar la fecha desde WhatsApp actualiza el mismo folio (versión + audit) y no duplica', () => {
    const t = T.seed()
    say(t, 'C-001', 'Mesa para 2 el martes a las 20')
    say(t, 'C-001', 'sí')
    t.ok({ type: 'res/accept', id: 'R-019' })
    const v = t.get('reservations', 'R-019').version
    say(t, 'C-001', 'Quiero cambiar la fecha')
    expect(last(t, 'C-001')[0]).toMatch(/¿Para cuándo la querés\?/)
    say(t, 'C-001', 'el miércoles a las 21')
    expect(last(t, 'C-001')[0]).toMatch(/Pasaría R-019 al miércoles 21 a las 21:00/)
    say(t, 'C-001', 'Confirmar cambio', 'confirm')
    const r = t.get('reservations', 'R-019')
    expect(r).toMatchObject({ dateKey: '2026-10-21', startMin: 21 * 60 })
    expect(r.version).toBe(v + 1)
    expect(t.count('reservations')).toBe(19)
    expect(t.s.audit.some((a) => a.type === 'reservation.rescheduled' && a.entityId === 'R-019')).toBe(true)
  })
  it('S29: fuera de alcance dos veces → fallback y derivación con el texto conservado', () => {
    const t = T.seed()
    say(t, 'C-001', 'Quiero una hipoteca')
    expect(last(t, 'C-001')[0]).toBe('Puedo ayudarte con carta, reservas o seguimiento. ¿Querés hablar con el equipo?')
    expect(t.s.tasks.filter((x) => x.entityId === 'C-001')).toHaveLength(0)
    say(t, 'C-001', 'Necesito un préstamo hipotecario')
    expect(last(t, 'C-001')[0]).toMatch(/te derivo con el equipo.*“Necesito un préstamo hipotecario”/)
    const task = t.s.tasks.find((x) => x.entityId === 'C-001' && x.kind === 'fuera-de-alcance')!
    expect(task.conversationId).toBe('C-001')
    expect(msgs(t, 'C-001').filter((m) => m.from === 'cliente')).toHaveLength(2) // historial conservado
    expect(t.get('conversations', 'C-001').handoff).toBe(true)
  })
  it('pedido por chat (café): flat white con leche vegetal → tamaño → sede → hora → resumen → O-013 enviado en barra', () => {
    const t = T.seed()
    say(t, 'C-003', 'Un flat white con leche vegetal')
    expect(last(t, 'C-003')[0]).toBe('¿Tamaño?')
    say(t, 'C-003', 'Mediano', 'pick:MG-tamano:ta-mediano')
    expect(last(t, 'C-003')[0]).toBe('¿En qué sede lo retirás?')
    say(t, 'C-003', 'Centro', 'sede:L-RC-centro')
    expect(last(t, 'C-003')[0]).toBe('¿A qué hora lo retirás?')
    say(t, 'C-003', '10:30', 'pickup:630')
    expect(last(t, 'C-003')[0]).toMatch(/Un Flat white \(mediano, vegetal \(avena\)\), sede Ritual Café · Centro, retiro 10:30, total \$ 7\.300,00\. ¿Confirmás el pedido\?/)
    expect(t.count('orders')).toBe(12)
    say(t, 'C-003', 'Confirmar pedido', 'confirm')
    expect(t.get('orders', 'O-013')).toMatchObject({ status: 'enviado', conversationId: 'C-003', channel: 'whatsapp', kind: 'retiro' })
    expect(last(t, 'C-003')[0]).toMatch(/Listo: O-013 enviado a la barra/)
    expect(t.count('orders')).toBe(13)
    // "Ya lo hice por la web": pide folio y enlaza, no crea otro
    say(t, 'C-003', 'Ya lo hice por la web')
    expect(last(t, 'C-003')[0]).toMatch(/Pasame el folio/)
    say(t, 'C-003', 'O-011')
    expect(t.get('orders', 'O-011').conversationId).toBe('C-003')
    expect(t.count('orders')).toBe(13)
    expect(validateState(t.s)).toEqual([])
  })
  it('perfil sin reservas: intención de reservar explica la política y deriva (S15)', () => {
    const t = T.seed()
    say(t, 'C-003', 'Quiero reservar una mesa para 4')
    expect(last(t, 'C-003')[0]).toMatch(/atendemos por orden de llegada/)
    expect(t.count('reservations')).toBe(18)
    expect(t.s.tasks.some((x) => x.entityId === 'C-003')).toBe(true)
  })
  it('S34: web → chat → llamada conserva el folio; confirmar abre el registro existente', () => {
    const t = T.seed()
    t.ok({ type: 'res/request', businessId: 'mesa-clara', locationId: 'L-MC-salon', dateKey: MON, startMin: 21 * 60 + 45, party: 4, alias: 'Ana', customerId: 'CL-001', channel: 'web', operationId: 'web-op-1', sectorPref: 'cualquiera' })
    expect(t.get('reservations', 'R-019').operationId).toBe('web-op-1')
    t.ok({ type: 'chat/continue', reservationId: 'R-019', channel: 'whatsapp' })
    expect(last(t, 'C-001')[0]).toMatch(/Seguimos tu solicitud R-019 por WhatsApp/)
    say(t, 'C-001', 'Confirmar solicitud', 'confirm')
    expect(last(t, 'C-001')[0]).toMatch(/ya está registrada como R-019.*no se creó otra/)
    expect(t.count('reservations')).toBe(19)
    // ahora por llamada
    const call = t.ok({ type: 'call/start', conversationId: 'C-001', reservationId: 'R-019' }) as any
    const callId = call.data.callId
    t.ok({ type: 'call/ready', callId, token: 1 })
    t.ok({ type: 'call/say', callId, optionId: 'confirm' })
    t.ok({ type: 'call/respond', callId, token: 1 })
    expect(t.get('callSessions', callId)).toMatchObject({ status: 'solicitud_creada', reservationId: 'R-019' })
    expect(t.count('reservations')).toBe(19)
    expect(t.get('callSessions', callId).transcript.at(-1).text).toMatch(/Ya existe la solicitud R-019/)
  })
  it('reiniciar la conversación no cancela las reservas vinculadas', () => {
    const t = T.seed()
    say(t, 'C-001', 'Mesa para 2 el martes a las 20')
    say(t, 'C-001', 'sí')
    const f = t.fail({ type: 'chat/reset', conversationId: 'C-001' }, 'reserva-activa') as any
    expect(f.data.ids).toEqual(['R-019'])
    t.ok({ type: 'chat/reset', conversationId: 'C-001', keep: true })
    expect(t.get('reservations', 'R-019').status).toBe('solicitada')
  })
  it('correlationId del hilo se conserva en los eventos de la conversación', () => {
    const t = T.seed()
    say(t, 'C-001', 'Mesa para 2 el martes a las 20')
    say(t, 'C-001', 'sí')
    expect(t.get('reservations', 'R-019').correlationId).toBe('COR-C-001')
    expect(t.s.audit.find((a) => a.type === 'reservation.requested' && a.entityId === 'R-019')!.correlationId).toBe('COR-C-001')
  })
})

describe('Llamada simulada (M11)', () => {
  const start = (t: T, cid = 'C-001') => {
    const c = t.ok({ type: 'call/start', conversationId: cid }) as any
    const callId = c.data.callId as string
    t.ok({ type: 'call/ready', callId, token: 1 })
    return callId
  }
  const turn = (t: T, callId: string, optionId: string) => {
    const r = t.ok({ type: 'call/say', callId, optionId }) as any
    return t.run({ type: 'call/respond', callId, token: t.get('callSessions', callId).token })
  }
  it('S31: rama A completa con transcripción: sin cupo → 21:45 → resumen → solicitud', () => {
    const t = T.seed()
    const id = start(t)
    expect(t.get('callSessions', id).status).toBe('turno_cliente')
    turn(t, id, 'reserveA')
    let call = t.get('callSessions', id)
    expect(call.status).toBe('respuesta')
    expect(call.transcript.at(-1).text).toMatch(/no hay mesa de cuatro a las 20:00.*21:45/)
    turn(t, id, 'accept')
    expect(t.get('callSessions', id).status).toBe('resumen')
    turn(t, id, 'confirm')
    call = t.get('callSessions', id)
    expect(call.status).toBe('solicitud_creada')
    expect(call.reservationId).toBe('R-019')
    expect(t.get('reservations', 'R-019')).toMatchObject({ channel: 'voz', status: 'solicitada', startMin: 21 * 60 + 45 })
    t.ok({ type: 'call/end', callId: id })
    expect(t.get('reservations', 'R-019').status).toBe('solicitada') // finalizar conserva la reserva
  })
  it('S32: dos silencios finalizan sin reserva (y avanzar reloj de la llamada cuenta como silencio)', () => {
    const t = T.seed()
    const id = start(t)
    t.ok({ type: 'call/tick', callId: id, seconds: 4 })
    expect(t.get('callSessions', id).silences).toBe(0)
    t.ok({ type: 'call/tick', callId: id, seconds: 6 })
    expect(t.get('callSessions', id).silences).toBe(1)
    expect(t.get('callSessions', id).transcript.at(-1).text).toMatch(/repita las opciones o te paso con recepción/)
    t.ok({ type: 'call/say', callId: id, optionId: 'silence' })
    const call = t.get('callSessions', id)
    expect(call).toMatchObject({ status: 'finalizada', endReason: 'silencio', reservationId: null })
    expect(t.count('reservations')).toBe(18)
  })
  it('rama B: tras el primer silencio se puede repetir opciones o pasar a recepción', () => {
    const t = T.seed()
    const id = start(t)
    t.ok({ type: 'call/say', callId: id, optionId: 'silence' })
    turn(t, id, 'repeat')
    expect(t.get('callSessions', id).status).toBe('respuesta')
    turn(t, id, 'reserveA')
    expect(t.get('callSessions', id).status).toBe('respuesta')
  })
  it('S33: detener antes de confirmar no crea reserva fantasma ni deja callbacks vivos', () => {
    const t = T.seed()
    const id = start(t)
    t.ok({ type: 'call/say', callId: id, optionId: 'reserveA' })
    const tokenBefore = t.get('callSessions', id).token
    t.ok({ type: 'call/end', callId: id })
    expect(t.get('callSessions', id).token).toBe(tokenBefore + 1)
    const late = t.ok({ type: 'call/respond', callId: id, token: tokenBefore }) as any
    expect(late.duplicate).toBe(true) // callback tardío ignorado
    expect(t.get('callSessions', id).status).toBe('finalizada')
    expect(t.count('reservations')).toBe(18)
    // una opción que no corresponde al momento de la llamada se rechaza
    const id2 = start(t)
    t.fail({ type: 'call/say', callId: id2, optionId: 'accept' }, 'opcion-invalida')
  })
  it('rama C: alergia → derivación; 16 personas → borrador pendiente sin mesa', () => {
    const t = T.seed()
    const a = start(t)
    turn(t, a, 'allergy')
    expect(t.get('callSessions', a)).toMatchObject({ status: 'derivada', branch: 'C' })
    expect(t.get('callSessions', a).transcript.at(-1).text).toMatch(/no puede garantizar ausencia de alérgenos/)
    expect(t.s.tasks.some((x) => x.kind === 'alimentaria' && x.entityId === a)).toBe(true)
    const b = start(t)
    turn(t, b, 'group16')
    const call = t.get('callSessions', b)
    expect(call.status).toBe('derivada')
    expect(t.get('reservations', call.reservationId)).toMatchObject({ status: 'revision_humana', party: 16, tableId: null })
  })
  it('reiniciar no cancela la reserva confirmada: pide conservar', () => {
    const t = T.seed()
    const id = start(t)
    turn(t, id, 'reserveA')
    turn(t, id, 'accept')
    turn(t, id, 'confirm')
    t.fail({ type: 'call/reset', callId: id }, 'reserva-activa')
    t.ok({ type: 'call/reset', callId: id, keep: true })
    expect(t.get('reservations', 'R-019').status).toBe('solicitada')
    expect(t.s.callSessions.filter((c) => c.conversationId === 'C-001')).toHaveLength(2) // varias sesiones, un solo registro
  })
})
