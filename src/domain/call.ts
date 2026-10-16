import { audit, base, byId, dup, fail, nextId, normalize, ok, type Ctx } from './core'
import { alternatives, businessDuration, isPast, slotAvailable, slotInService } from './availability'
import { bookingHandlers } from './cmd-booking'
import { defaultLocation } from './chat'
import { addMessage } from './messaging'
import { createTask } from './tasks'
import { dateKeyOf, hhmm, minutesOfDay } from './time'
import { numberWord, parseDate, parseParty, parseTime, summarizeDay } from './nlu'
import { emit } from './core'
import type { AppState, CallSession } from './types'
import type { Handler } from './cmd-commerce'

export const SILENCE_SECONDS = 10

export interface CallOption {
  id: string
  label: string
  text: string // lo que "dice" la persona, queda en la transcripción
}

const OPT = {
  reserveA: { id: 'reserveA', label: 'Decir: “Somos cuatro para el lunes a las ocho”', text: 'Somos cuatro para el lunes a las ocho' },
  silence: { id: 'silence', label: 'Quedarse en silencio', text: '(silencio)' },
  allergy: { id: 'allergy', label: 'Decir: “Tengo alergia a frutos secos”', text: 'Tengo alergia a frutos secos' },
  group16: { id: 'group16', label: 'Decir: “Somos dieciséis el sábado a las nueve”', text: 'Somos dieciséis el sábado a las nueve' },
  accept: { id: 'accept', label: 'Aceptar la alternativa', text: 'Sí, esa hora me sirve' },
  decline: { id: 'decline', label: 'No, gracias', text: 'No, gracias' },
  confirm: { id: 'confirm', label: 'Confirmar la solicitud', text: 'Sí, confirmo' },
  repeat: { id: 'repeat', label: 'Repetir opciones', text: 'Repetí las opciones, por favor' },
  reception: { id: 'reception', label: 'Pasar a recepción', text: 'Pasame con recepción' },
} satisfies Record<string, CallOption>

/** Opciones por botones disponibles según el estado (no hay micrófono ni reconocimiento de voz). */
export function callOptions(call: CallSession): CallOption[] {
  if (['finalizada', 'solicitud_creada', 'derivada', 'procesando', 'iniciando', 'inactiva'].includes(call.status)) return []
  const d = call.draft as { stage?: string }
  if (d.stage === 'alt') return [OPT.accept, OPT.reception, OPT.silence]
  if (d.stage === 'confirm') return [OPT.confirm, OPT.decline, OPT.silence]
  if (d.stage === 'silence1') return [OPT.repeat, OPT.reception, OPT.silence]
  return [OPT.reserveA, OPT.allergy, OPT.group16, OPT.silence]
}

const say = (call: CallSession, who: CallSession['transcript'][number]['who'], text: string) => call.transcript.push({ who, text })

function greetingText(bizName: string) {
  return `Hola, soy el asistente de voz de ${bizName} en esta demo. Podés pedir una mesa, consultar algo o pasar con recepción. ¿En qué te ayudo?`
}

const callStart: Handler = (s, c, ctx) => {
  const conv = byId(s.conversations, c.conversationId)
  if (!conv) return fail('conversacion-inexistente', 'Conversación inexistente.')
  ctx.correlationId = conv.correlationId
  const biz = byId(s.businesses, conv.businessId)!
  // Una sola sesión activa por hilo: la anterior se cierra (sus timers quedan invalidados por token).
  for (const o of s.callSessions) {
    if (o.conversationId === conv.id && !['finalizada', 'solicitud_creada', 'derivada'].includes(o.status)) {
      o.status = 'finalizada'
      o.endReason = 'reemplazada'
      o.token++
      o.pendingResponse = null
    }
  }
  const call: CallSession = {
    id: nextId(s, 'CALL'),
    ...base(s, biz.id),
    conversationId: conv.id,
    status: 'iniciando',
    branch: null,
    silences: 0,
    transcript: [],
    draft: {},
    reservationId: null,
    endReason: null,
    token: 1,
    pendingResponse: null,
    waitedSec: 0,
    operationId: nextId(s, 'OP', 4),
  }
  s.callSessions.push(call)
  say(call, 'sistema', 'Llamada de demostración: no se realiza ninguna llamada real ni se usa el micrófono.')
  if (c.reservationId) {
    const r = byId(s.reservations, c.reservationId)
    if (r) {
      call.operationId = r.operationId
      call.draft = { stage: 'confirm', party: r.party, dateKey: r.dateKey, startMin: r.startMin, locationId: r.locationId, reservationId: r.id }
      conv.reservationIds.includes(r.id) || conv.reservationIds.push(r.id)
      r.conversationId = r.conversationId ?? conv.id
    }
  }
  audit(s, ctx, biz.id, 'call.started', 'CallSession', call.id, `Llamada simulada ${call.id} iniciada por voluntad de la persona (hilo ${conv.id})`)
  return ok({ callId: call.id })
}

/** iniciando → turno_cliente (la UI lo dispara tras un breve y cancelable "iniciando"). */
const callReady: Handler = (s, c) => {
  const call = byId(s.callSessions, c.callId)
  if (!call) return fail('llamada-inexistente', 'Llamada inexistente.')
  if (call.status !== 'iniciando' || call.token !== c.token) return dup()
  const biz = byId(s.businesses, call.businessId)!
  const d = call.draft as { stage?: string; party?: number; dateKey?: string; startMin?: number }
  if (d.stage === 'confirm') {
    say(call, 'asistente', `Retomamos tu solicitud: ${d.party} personas el ${summarizeDay(d.dateKey!)} a las ${hhmm(d.startMin!)}. ¿Confirmás?`)
    call.status = 'resumen'
  } else {
    say(call, 'asistente', greetingText(biz.name))
    call.status = 'turno_cliente'
  }
  call.version++
  return ok()
}

const callSay: Handler = (s, c, ctx) => {
  const call = byId(s.callSessions, c.callId)
  if (!call) return fail('llamada-inexistente', 'Llamada inexistente.')
  if (['finalizada', 'solicitud_creada', 'derivada'].includes(call.status)) return fail('llamada-terminada', 'La llamada ya terminó.')
  if (call.status === 'procesando') return dup({}, 'Todavía estoy procesando tu turno.')
  const opt = callOptions(call).find((o) => o.id === c.optionId)
  if (!opt) return fail('opcion-invalida', 'Esa opción no está disponible en este momento de la llamada.')
  ctx.correlationId = byId(s.conversations, call.conversationId)?.correlationId ?? ctx.correlationId
  if (opt.id === 'silence') {
    return handleSilence(s, ctx, call)
  }
  say(call, 'cliente', opt.text)
  call.waitedSec = 0
  call.status = 'procesando'
  call.pendingResponse = opt.id
  call.version++
  return ok({ token: call.token })
}

function handleSilence(s: AppState, ctx: Ctx, call: CallSession) {
  call.silences++
  call.waitedSec = 0
  say(call, 'cliente', '(silencio)')
  if (call.silences >= 2) {
    call.status = 'finalizada'
    call.endReason = 'silencio'
    call.token++
    call.pendingResponse = null
    say(call, 'asistente', 'No escucho respuesta, así que finalizo la llamada. No se creó ninguna reserva.')
    audit(s, ctx, call.businessId, 'call.ended', 'CallSession', call.id, `Llamada ${call.id} finalizada por dos silencios; sin reserva`)
    call.version++
    return ok({ ended: true })
  }
  ;(call.draft as { stage?: string }).stage = 'silence1'
  say(call, 'asistente', 'No te escuché. ¿Querés que repita las opciones o te paso con recepción?')
  call.status = 'respuesta'
  call.version++
  return ok({ silences: call.silences })
}

/** "Avanzar reloj" de la llamada: si se agotan los segundos de silencio, cuenta como silencio. */
const callTick: Handler = (s, c, ctx) => {
  const call = byId(s.callSessions, c.callId)
  if (!call) return fail('llamada-inexistente', 'Llamada inexistente.')
  if (!['turno_cliente', 'respuesta', 'resumen'].includes(call.status)) return dup()
  call.waitedSec += c.seconds ?? SILENCE_SECONDS
  if (call.waitedSec >= SILENCE_SECONDS) return handleSilence(s, ctx, call)
  call.version++
  return ok({ waitedSec: call.waitedSec })
}

/** Respuesta diferida: un callback tardío (token viejo o llamada detenida) no hace nada. */
const callRespond: Handler = (s, c, ctx) => {
  const call = byId(s.callSessions, c.callId)
  if (!call) return fail('llamada-inexistente', 'Llamada inexistente.')
  if (call.status !== 'procesando' || call.token !== c.token || !call.pendingResponse) return dup({}, 'Callback tardío ignorado.')
  const conv = byId(s.conversations, call.conversationId)!
  ctx.correlationId = conv.correlationId
  const biz = byId(s.businesses, call.businessId)!
  const optId = call.pendingResponse
  call.pendingResponse = null
  const d = call.draft as Record<string, any>
  const locationId = (d.locationId as string) ?? defaultLocation(s, biz)
  d.locationId = locationId

  if (optId === 'reserveA') {
    call.branch = 'A'
    const n = normalize(OPT.reserveA.text)
    const dateKey = parseDate(n, s.clock.nowMs, minutesOfDay(s.clock.nowMs))?.dateKey ?? dateKeyOf(s.clock.nowMs)
    const { service } = businessDuration(s, biz.id)
    const t = parseTime(n, (m) => slotInService(s, locationId, dateKey, m, service))
    const party = parseParty(n) ?? 4
    Object.assign(d, { party, dateKey, startMin: t!.startMin })
    const q = { businessId: biz.id, locationId, dateKey, startMin: t!.startMin, party, sectorPref: 'cualquiera' as const }
    if (!isPast(s, dateKey, t!.startMin) && slotAvailable(s, q)) {
      d.stage = 'confirm'
      say(call, 'asistente', `Serían ${party} personas el ${summarizeDay(dateKey)} a las ${hhmm(t!.startMin)}, salón. Tu preferencia no garantiza sector. ¿Confirmás la solicitud?`)
      call.status = 'resumen'
    } else {
      const alts = alternatives(s, q, 3)
      d.alts = alts
      if (alts.length) {
        d.stage = 'alt'
        say(call, 'asistente', `En el día simulado no hay mesa de ${numberWord(party)} a las ${hhmm(t!.startMin)}. Puedo ofrecerte las ${hhmm(alts[0])}, según la disponibilidad de muestra.`)
        call.status = 'respuesta'
      } else {
        d.stage = 'start'
        say(call, 'asistente', 'Ese día no tengo horarios con lugar. Podés pasar con recepción.')
        call.status = 'respuesta'
      }
    }
  } else if (optId === 'accept') {
    d.startMin = (d.alts as number[])[0]
    d.stage = 'confirm'
    say(call, 'asistente', `Serían ${d.party} personas el ${summarizeDay(d.dateKey)} a las ${hhmm(d.startMin)}, salón. Tu preferencia no garantiza sector. ¿Confirmás la solicitud?`)
    call.status = 'resumen'
  } else if (optId === 'decline') {
    d.stage = 'start'
    say(call, 'asistente', 'Perfecto, no creo ninguna solicitud. ¿Querés probar otra opción o pasar con recepción?')
    call.status = 'respuesta'
  } else if (optId === 'repeat') {
    d.stage = 'start'
    say(call, 'asistente', 'Las opciones son: pedir una mesa, consultar por alergias o grupos grandes, o pasar con recepción.')
    call.status = 'respuesta'
  } else if (optId === 'reception') {
    call.branch = call.branch ?? 'C'
    createTask(s, ctx, { businessId: biz.id, kind: 'fuera-de-alcance', entityType: 'CallSession', entityId: call.id, conversationId: conv.id, note: 'La persona pidió pasar con recepción durante la llamada simulada.', draft: { ...d } })
    emit(ctx, { type: 'chat.humanReview', businessId: biz.id, entityType: 'CallSession', entityId: call.id, payload: { reason: 'fuera-de-alcance' } })
    say(call, 'asistente', 'Te paso con recepción: dejé el pedido anotado para que el equipo te responda.')
    call.status = 'derivada'
    call.endReason = 'derivada'
  } else if (optId === 'allergy') {
    call.branch = 'C'
    d.dietaryNote = 'Alergia a frutos secos'
    let reservationNote = ''
    if (d.party && d.dateKey && d.startMin !== undefined) {
      const r = bookingHandlers['res/request'](s, { businessId: biz.id, locationId, dateKey: d.dateKey, startMin: d.startMin, party: d.party, alias: byId(s.customers, conv.customerId)?.alias ?? 'Llamada', customerId: conv.customerId, channel: 'voz', conversationId: conv.id, operationId: call.operationId, dietaryNote: d.dietaryNote }, ctx)
      if (r.ok) {
        call.reservationId = (r.data as any).reservationId
        reservationNote = ` Dejé el borrador ${call.reservationId} en revisión humana.`
      }
    } else {
      createTask(s, ctx, { businessId: biz.id, kind: 'alimentaria', entityType: 'CallSession', entityId: call.id, conversationId: conv.id, note: 'Consulta alimentaria por llamada simulada: alergia a frutos secos. No se garantiza ausencia de alérgenos.', draft: { ...d } })
      emit(ctx, { type: 'chat.humanReview', businessId: biz.id, entityType: 'CallSession', entityId: call.id, payload: { reason: 'alimentaria' } })
    }
    say(call, 'asistente', `Voy a derivar tu consulta al equipo para que confirme ingredientes y preparación. Esta demo no puede garantizar ausencia de alérgenos.${reservationNote}`)
    call.status = 'derivada'
    call.endReason = 'derivada'
  } else if (optId === 'group16') {
    call.branch = 'C'
    const n = normalize(OPT.group16.text)
    const dateKey = parseDate(n, s.clock.nowMs, 0)?.dateKey ?? dateKeyOf(s.clock.nowMs)
    const { service } = businessDuration(s, biz.id)
    const t = parseTime(n, (m) => slotInService(s, locationId, dateKey, m, service)) ?? { startMin: 21 * 60 }
    const r = bookingHandlers['res/request'](s, { businessId: biz.id, locationId, dateKey, startMin: t.startMin, party: 16, alias: byId(s.customers, conv.customerId)?.alias ?? 'Llamada', customerId: conv.customerId, channel: 'voz', conversationId: conv.id, operationId: call.operationId }, ctx)
    if (r.ok) {
      call.reservationId = (r.data as any).reservationId
      if (!conv.reservationIds.includes(call.reservationId!)) conv.reservationIds.push(call.reservationId!)
      say(call, 'asistente', `Para dieciséis personas el equipo revisa cada caso y no se asigna mesa automáticamente. Dejé una consulta grupal pendiente: ${call.reservationId}.`)
    } else {
      say(call, 'asistente', r.message)
    }
    call.status = 'derivada'
    call.endReason = 'derivada'
  } else if (optId === 'confirm') {
    const r = bookingHandlers['res/request'](
      s,
      { businessId: biz.id, locationId, dateKey: d.dateKey, startMin: d.startMin, party: d.party, alias: byId(s.customers, conv.customerId)?.alias ?? 'Llamada', customerId: conv.customerId, channel: 'voz', conversationId: conv.id, operationId: call.operationId },
      ctx,
    )
    if (!r.ok) {
      say(call, 'asistente', r.message)
      d.stage = 'start'
      call.status = 'respuesta'
    } else {
      const id = (r.data as { reservationId: string }).reservationId
      call.reservationId = id
      if (!conv.reservationIds.includes(id)) conv.reservationIds.push(id)
      const res = byId(s.reservations, id)!
      say(call, 'asistente', r.duplicate ? `Ya existe la solicitud ${id}: abro el registro existente, no creo otra.` : `Listo, tu solicitud es ${id}. Recepción todavía debe confirmarla.`)
      addMessage(s, ctx, conv, { from: 'sistema', text: `Llamada ${call.id}: solicitud ${id} (${res.status.replace('_', ' ')}).`, channel: 'voz', link: { label: 'Ver mi reserva', to: `/${biz.id}/reservas/${id}` } })
      call.status = 'solicitud_creada'
      call.endReason = null
    }
  }
  call.version++
  return ok({ status: call.status })
}

/** Detener / colgar: invalida timers y callbacks; no crea reservas fantasma. */
const callEnd: Handler = (s, c, ctx) => {
  const call = byId(s.callSessions, c.callId)
  if (!call) return fail('llamada-inexistente', 'Llamada inexistente.')
  if (call.status === 'finalizada') return dup()
  const hadRes = call.reservationId
  call.token++
  call.pendingResponse = null
  call.status = 'finalizada'
  call.endReason = call.endReason ?? (c.reason ?? 'detenida')
  say(call, 'sistema', hadRes ? `Llamada finalizada. La solicitud ${hadRes} se conserva.` : 'Llamada detenida. No se creó ninguna reserva.')
  audit(s, ctx, call.businessId, 'call.ended', 'CallSession', call.id, `Llamada ${call.id} finalizada (${call.endReason})${hadRes ? `; conserva ${hadRes}` : ''}`)
  call.version++
  return ok()
}

/** Reiniciar: si hay reserva confirmada/solicitada no se cancela sola; se elige conservar. */
const callReset: Handler = (s, c, ctx) => {
  const call = byId(s.callSessions, c.callId)
  if (!call) return fail('llamada-inexistente', 'Llamada inexistente.')
  const res = byId(s.reservations, call.reservationId)
  if (res && ['solicitada', 'confirmada', 'alternativa_ofrecida', 'revision_humana', 'llegada'].includes(res.status) && !c.keep) {
    return fail('reserva-activa', `La llamada creó ${res.id}. Reiniciar no la cancela: elegí conservarla o cancelala por su flujo en “Mi reserva”.`, { reservationId: res.id })
  }
  const o = callStart(s, { conversationId: call.conversationId }, ctx)
  if (!o.ok) return o
  if (call.status !== 'finalizada') {
    call.status = 'finalizada'
    call.endReason = 'reiniciada'
    call.token++
  }
  return o
}

export const callHandlers: Record<string, Handler> = {
  'call/start': callStart,
  'call/ready': callReady,
  'call/say': callSay,
  'call/tick': callTick,
  'call/respond': callRespond,
  'call/end': callEnd,
  'call/reset': callReset,
}
