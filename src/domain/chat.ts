import { audit, base, byId, emit, fail, nextId, normalize, ok, type Ctx, type Outcome } from './core'
import { alternatives, freeSlots, isPast, slotAvailable, slotInService, businessDuration, windowsFor } from './availability'
import { bookingHandlers } from './cmd-booking'
import { commerceHandlers, getOrCreateCart } from './cmd-commerce'
import { ensureCustomer } from './customers'
import { addMessage } from './messaging'
import { checkLine, groupsOf, itemUnavailable, menuFor, categoriesOf } from './menu'
import { detectIntent, fmtSlot, numberWord, parseDate, parseParty, parseTime, summarizeDay } from './nlu'
import { pickupSlots } from './pickup'
import { createTask } from './tasks'
import { addDays, dateKeyOf, dayName, hhmm, minutesOfDay } from './time'
import { fmtARS } from './money'
import type { AppState, BusinessProfile, ChatAction, Conversation, Message, MenuItem, Reservation } from './types'
import type { Handler } from './cmd-commerce'

export interface Reply {
  text: string
  actions?: ChatAction[]
  link?: Message['link']
}
const A = (label: string, payload: string): ChatAction => ({ id: `${payload}`, label, payload })

const ACTIVE_RES: Reservation['status'][] = ['solicitada', 'confirmada', 'alternativa_ofrecida', 'revision_humana', 'llegada']

export function defaultLocation(s: AppState, biz: BusinessProfile): string {
  return s.session.locationByBusiness[biz.id] ?? s.locations.find((l) => l.businessId === biz.id && l.hasTables)?.id ?? s.locations.find((l) => l.businessId === biz.id)!.id
}

function activeReservationsOf(s: AppState, conv: Conversation): Reservation[] {
  return s.reservations.filter(
    (r) => r.businessId === conv.businessId && ACTIVE_RES.includes(r.status) && ((conv.customerId && r.customerId === conv.customerId) || conv.reservationIds.includes(r.id)),
  )
}
const resLine = (r: Reservation) => `${r.id} (${r.party} pers., ${dayName(r.dateKey)} ${Number(r.dateKey.slice(8))} ${hhmm(r.startMin)}, ${r.status.replace('_', ' ')})`
const folioIn = (n: string) => {
  const m = /\b([ro])-?(\d{1,4})\b/.exec(n)
  return m ? `${m[1].toUpperCase()}-${m[2].padStart(3, '0')}` : null
}

function handoff(s: AppState, ctx: Ctx, conv: Conversation, reason: string, kind: 'fuera-de-alcance' | 'alimentaria', draft?: Record<string, unknown>) {
  conv.handoff = true
  const t = createTask(s, ctx, {
    businessId: conv.businessId,
    kind,
    entityType: 'Conversation',
    entityId: conv.id,
    conversationId: conv.id,
    note: reason,
    draft: draft ?? null,
  })
  emit(ctx, { type: 'chat.humanReview', businessId: conv.businessId, entityType: 'Conversation', entityId: conv.id, payload: { reason: kind } })
  return t
}

// ================================================================== reservar
interface RData {
  party?: number
  dateKey?: string
  startMin?: number
  dateCandidate?: string
  alias?: string
  operationId: string
  dietaryNote?: string
  reservationId?: string
  alts?: number[]
  locationId: string
}

function startReserve(s: AppState, conv: Conversation, biz: BusinessProfile): RData {
  const data: RData = { operationId: nextId(s, 'OP', 4), locationId: defaultLocation(s, biz) }
  conv.flow = { type: 'reserva', step: 'party', data: data as unknown as Record<string, unknown> }
  return data
}

function fillFromText(s: AppState, data: RData, biz: BusinessProfile, n: string) {
  const within = (min: number) => slotInService(s, data.locationId, data.dateKey ?? dateKeyOf(s.clock.nowMs), min, businessDuration(s, biz.id).service)
  const party = parseParty(n)
  if (party) data.party = party
  const d = parseDate(n, s.clock.nowMs, minutesOfDay(s.clock.nowMs))
  if (d?.dateKey && !d.ambiguous) {
    data.dateKey = d.dateKey
    data.dateCandidate = undefined
  } else if (d?.ambiguous && d.candidate) data.dateCandidate = d.candidate
  else if (d?.needsDay) data.dateKey = undefined
  const t = parseTime(n, within)
  if (t) data.startMin = t.startMin
}

function nextDays(s: AppState, locationId: string, count = 4): ChatAction[] {
  const out: ChatAction[] = []
  let dk = dateKeyOf(s.clock.nowMs)
  for (let i = 0; i < 10 && out.length < count; i++, dk = addDays(dk, 1)) {
    if (windowsFor(s, locationId, dk).length) out.push(A(`${dayName(dk)} ${Number(dk.slice(8))}`, `date:${dk}`))
  }
  return out
}

function reserveStep(s: AppState, ctx: Ctx, conv: Conversation, biz: BusinessProfile): Reply[] {
  const flow = conv.flow!
  const data = flow.data as unknown as RData
  if (data.dateCandidate) {
    flow.step = 'date-confirm'
    return [{ text: `¿Te referís al ${dayName(data.dateCandidate)} ${Number(data.dateCandidate.slice(8))} de ${monthLong(data.dateCandidate)}?`, actions: [A('Sí', 'confirm'), A('Otro día', 'deny')] }]
  }
  if (!data.party) {
    flow.step = 'party'
    return [{ text: '¿Para cuántas personas?', actions: [2, 4, 6].map((n) => A(String(n), `party:${n}`)) }]
  }
  if (!data.dateKey) {
    flow.step = 'date'
    return [{ text: '¿Para qué día?', actions: nextDays(s, data.locationId) }]
  }
  if (data.startMin === undefined) {
    flow.step = 'time'
    const slots = freeSlots(s, { businessId: biz.id, locationId: data.locationId, dateKey: data.dateKey, party: Math.min(data.party, biz.maxPartyAuto) }).slice(0, 5)
    return [
      {
        text: slots.length ? `¿A qué hora? Hay lugar a las ${slots.map(hhmm).join(', ')} (según la disponibilidad de muestra).` : `Para ${fmtSlot(data.dateKey, 0).split(' a las')[0]} no veo horarios con lugar. Podés elegir otro día o anotarte en la lista de espera.`,
        actions: slots.length ? slots.map((m) => A(hhmm(m), `slot:${m}`)) : [A('Otro día', 'deny'), A('Lista de espera', 'wait')],
      },
    ]
  }
  // datos completos
  const { service } = businessDuration(s, biz.id)
  if (isPast(s, data.dateKey, data.startMin)) {
    data.startMin = undefined
    return [{ text: 'Ese horario ya pasó en el día simulado. ¿Qué otro horario preferís?' }]
  }
  if (!slotInService(s, data.locationId, data.dateKey, data.startMin, service)) {
    const open = windowsFor(s, data.locationId, data.dateKey)
    data.startMin = undefined
    return [
      {
        text: open.length ? `A esa hora estamos cerrados. Atendemos ${open.map((w) => `${hhmm(w.startMin)}–${hhmm(w.endMin)}`).join(' y ')}. ¿Qué horario te sirve?` : 'Ese día no hay servicio. ¿Probamos otro día?',
        actions: open.length ? undefined : nextDays(s, data.locationId),
      },
    ]
  }
  const big = data.party > biz.maxPartyAuto
  if (big) {
    flow.step = 'confirm'
    return [
      {
        text: `Para ${data.party} personas el equipo revisa cada caso y no asigna mesa automáticamente. Serían ${data.party} personas el ${summarizeDay(data.dateKey)} a las ${hhmm(data.startMin)}. ¿Enviamos la consulta al equipo?`,
        actions: [A('Enviar consulta', 'confirm'), A('Cambiar', 'deny')],
      },
    ]
  }
  const q = { businessId: biz.id, locationId: data.locationId, dateKey: data.dateKey, startMin: data.startMin, party: data.party, sectorPref: 'cualquiera' as const }
  if (!data.dietaryNote && !slotAvailable(s, q)) {
    const alts = alternatives(s, q, 3)
    data.alts = alts
    flow.step = 'alt'
    if (!alts.length) {
      return [{ text: `En el día simulado no hay mesa de ${numberWord(data.party)} a las ${hhmm(data.startMin)} ni otro horario ese día. ¿Querés anotarte en la lista de espera?`, actions: [A('Lista de espera', 'wait'), A('Otro día', 'deny')] }]
    }
    return [
      {
        text: `En el día simulado no hay mesa de ${numberWord(data.party)} a las ${hhmm(data.startMin)}. Puedo ofrecer ${hhmm(alts[0])}, según la disponibilidad de muestra`,
        actions: [...alts.map((m) => A(hhmm(m), `alt:${m}`)), A('Lista de espera', 'wait')],
      },
    ]
  }
  flow.step = 'confirm'
  return [
    {
      text: `Serían ${data.party} ${data.party === 1 ? 'persona' : 'personas'} el ${summarizeDay(data.dateKey)} a las ${hhmm(data.startMin)}, salón. Tu preferencia no garantiza sector. ¿Confirmás la solicitud?`,
      actions: [A('Confirmar solicitud', 'confirm'), A('Cambiar', 'deny')],
    },
  ]
}
const monthLong = (dk: string) => ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][Number(dk.slice(5, 7)) - 1]

function submitReservation(s: AppState, ctx: Ctx, conv: Conversation, biz: BusinessProfile, channel: Message['channel']): Reply[] {
  const data = conv.flow!.data as unknown as RData
  let cu = byId(s.customers, conv.customerId)
  if (!cu) {
    if (!data.alias) {
      conv.flow!.step = 'alias'
      return [{ text: '¿A nombre de quién dejo la solicitud? (alias de muestra)' }]
    }
    cu = ensureCustomer(s, ctx, biz.id, data.alias, { whatsapp: channel === 'whatsapp', voz: channel === 'voz' })
    conv.customerId = cu.id
  }
  const r = bookingHandlers['res/request'](
    s,
    {
      businessId: biz.id,
      locationId: data.locationId,
      dateKey: data.dateKey,
      startMin: data.startMin,
      party: data.party,
      alias: cu.alias,
      customerId: cu.id,
      channel: channel === 'voz' ? 'voz' : 'whatsapp',
      conversationId: conv.id,
      operationId: data.operationId,
      dietaryNote: data.dietaryNote ?? null,
    },
    ctx,
  )
  if (!r.ok) {
    if (r.code === 'sin-cupo') {
      data.alts = ((r.data as any)?.alternatives as number[]) ?? []
      conv.flow!.step = 'alt'
      return [{ text: r.message, actions: [...data.alts.map((m) => A(hhmm(m), `alt:${m}`)), A('Lista de espera', 'wait')] }]
    }
    if (r.code === 'sin-reservas') {
      conv.flow = null
      handoff(s, ctx, conv, 'Intento de reservar en un perfil sin reservas (atención por orden de llegada).', 'fuera-de-alcance')
      return [{ text: `${r.message} Derivé tu consulta al equipo.` }]
    }
    return [{ text: r.message }]
  }
  const id = (r.data as { reservationId: string }).reservationId
  if (!conv.reservationIds.includes(id)) conv.reservationIds.push(id)
  const res = byId(s.reservations, id)!
  conv.flow = null
  const link = { label: 'Ver mi reserva', to: `/${biz.id}/reservas/${id}` }
  if (r.duplicate) return [{ text: `Esa solicitud ya está registrada como ${id} (${res.status.replace('_', ' ')}). Abrí el registro existente: no se creó otra.`, link }]
  if (res.status === 'revision_humana') {
    return [{ text: `Tu consulta quedó en revisión humana (${id}). El equipo la revisa antes de aceptar y no se asigna mesa automáticamente. Esta demo no puede garantizar ausencia de alérgenos.`, link }]
  }
  if (res.status === 'confirmada') return [{ text: `Reserva confirmada: ${id}.`, link }]
  return [{ text: `Solicitud recibida; el equipo todavía debe confirmarla. Folio: ${id}.`, link }]
}

function flowReserve(s: AppState, ctx: Ctx, conv: Conversation, biz: BusinessProfile, text: string, payload: string | undefined, channel: Message['channel']): Reply[] | null {
  const flow = conv.flow!
  const data = flow.data as unknown as RData
  const n = normalize(text)
  const intent = detectIntent(text)
  if (payload?.startsWith('party:')) data.party = Number(payload.slice(6))
  else if (payload?.startsWith('date:')) {
    data.dateKey = payload.slice(5)
    data.dateCandidate = undefined
  } else if (payload?.startsWith('slot:')) data.startMin = Number(payload.slice(5))
  else if (payload?.startsWith('alt:')) {
    data.startMin = Number(payload.slice(4))
    flow.step = 'confirm'
  } else if (payload === 'wait') return joinWaitlist(s, ctx, conv, biz, data)
  else if (flow.step === 'date-confirm') {
    if (payload === 'confirm' || intent === 'yes') {
      data.dateKey = data.dateCandidate
      data.dateCandidate = undefined
    } else if (payload === 'deny' || intent === 'no') {
      data.dateCandidate = undefined
      data.dateKey = undefined
    }
  } else if (flow.step === 'alias') {
    if (!n) return [{ text: 'Necesito un nombre para la solicitud.' }]
    data.alias = text.trim()
    return submitReservation(s, ctx, conv, biz, channel)
  } else if (flow.step === 'confirm') {
    if (payload === 'confirm' || (!payload && intent === 'yes')) return submitReservation(s, ctx, conv, biz, channel)
    if (payload === 'deny' || (!payload && intent === 'no')) {
      data.startMin = undefined
      flow.step = 'time'
      return [...reserveStep(s, ctx, conv, biz).map((r) => ({ ...r, text: `No envié nada. ${r.text}` }))]
    }
    fillFromText(s, data, biz, n)
  } else if (flow.step === 'alt' && (payload === 'confirm' || intent === 'yes') && data.alts?.length) {
    data.startMin = data.alts[0]
  } else if (payload === 'deny') {
    data.startMin = undefined
    data.dateKey = undefined
  } else {
    // texto libre: puede traer varios datos a la vez
    const before = JSON.stringify([data.party, data.dateKey, data.startMin])
    fillFromText(s, data, biz, n)
    if (before === JSON.stringify([data.party, data.dateKey, data.startMin]) && !data.dateCandidate) {
      if (detectIntent(text) === 'dietary') return null
      if (intent === 'unknown' || intent === 'greeting') return null
    }
  }
  return reserveStep(s, ctx, conv, biz)
}

function joinWaitlist(s: AppState, ctx: Ctx, conv: Conversation, biz: BusinessProfile, data: RData): Reply[] {
  const cu = byId(s.customers, conv.customerId)
  const alias = cu?.alias ?? data.alias
  if (!alias) {
    conv.flow!.step = 'alias'
    return [{ text: '¿A nombre de quién te anoto en la lista de espera?' }]
  }
  if (!data.party || !data.dateKey || data.startMin === undefined) return [{ text: 'Primero necesito cantidad de personas, día y horario.' }]
  const r = bookingHandlers['wait/add'](s, { businessId: biz.id, locationId: data.locationId, dateKey: data.dateKey, startMin: data.startMin, party: data.party, alias, customerId: cu?.id ?? null, operationId: `${data.operationId}-W` }, ctx)
  conv.flow = null
  if (!r.ok) return [{ text: r.message }]
  return [{ text: `Te anoté en la lista de espera (${(r.data as any).id}). Si se libera un lugar, el equipo valida la oferta; no se confirma sola.` }]
}

// ================================================================== cancelar / reprogramar
function pickReservation(s: AppState, conv: Conversation, kind: 'cancelar' | 'reprogramar', preselect?: string | null): Reply[] {
  const list = activeReservationsOf(s, conv)
  const verb = kind === 'cancelar' ? 'cancelo' : 'cambio'
  if (preselect) {
    const r = list.find((x) => x.id === preselect) ?? byId(s.reservations, preselect)
    if (r && r.businessId === conv.businessId && ACTIVE_RES.includes(r.status)) return startOn(s, conv, kind, r)
    return [{ text: `No encuentro la reserva ${preselect} activa en esta conversación.` }]
  }
  if (!list.length) return [{ text: 'No encuentro reservas activas a tu nombre. Si tenés un folio, escribilo (por ejemplo R-019).' }]
  if (list.length === 1) return startOn(s, conv, kind, list[0])
  conv.flow = { type: kind, step: 'choose', data: {} }
  return [{ text: `Tenés ${list.length} reservas activas: ${list.map(resLine).join('; ')}. ¿Cuál ${verb}? Indicame el folio.`, actions: list.map((r) => A(r.id, `choose:${r.id}`)) }]
}
function startOn(s: AppState, conv: Conversation, kind: 'cancelar' | 'reprogramar', r: Reservation): Reply[] {
  if (kind === 'cancelar') {
    conv.flow = { type: 'cancelar', step: 'confirm', data: { id: r.id } }
    return [{ text: `Encontré ${resLine(r)}. ¿Confirmás que la cancele?`, actions: [A('Sí, cancelar', 'confirm'), A('No, mantenerla', 'deny')] }]
  }
  conv.flow = { type: 'reprogramar', step: 'when', data: { id: r.id, version: r.version } }
  return [{ text: `Encontré ${resLine(r)}. ¿Para cuándo la querés? (por ejemplo: “el martes a las 21”)` }]
}

function flowCancel(s: AppState, ctx: Ctx, conv: Conversation, text: string, payload: string | undefined): Reply[] | null {
  const flow = conv.flow!
  const n = normalize(text)
  const folio = payload?.startsWith('choose:') ? payload.slice(7) : folioIn(n)
  if (flow.step === 'choose') {
    if (!folio) return [{ text: 'Indicame el folio de la reserva (por ejemplo R-019).' }]
    return pickReservation(s, conv, 'cancelar', folio)
  }
  const id = flow.data.id as string
  if (payload === 'confirm' || (!payload && detectIntent(text) === 'yes')) {
    const r = bookingHandlers['res/cancel'](s, { id, reason: 'Cancelada por el cliente desde el chat' }, ctx)
    conv.flow = null
    if (!r.ok) return [{ text: r.message }]
    return [{ text: r.duplicate ? `${id} ya estaba cancelada; el cupo se liberó una sola vez.` : `Listo, cancelé ${id} y liberé la mesa. Queda en el historial.`, link: { label: 'Ver mi reserva', to: `/${conv.businessId}/reservas/${id}` } }]
  }
  if (payload === 'deny' || detectIntent(text) === 'no') {
    conv.flow = null
    return [{ text: `Perfecto, mantengo ${id}. No cancelé nada.` }]
  }
  return null
}

function flowReschedule(s: AppState, ctx: Ctx, conv: Conversation, biz: BusinessProfile, text: string, payload: string | undefined): Reply[] | null {
  const flow = conv.flow!
  const n = normalize(text)
  if (flow.step === 'choose') {
    const folio = payload?.startsWith('choose:') ? payload.slice(7) : folioIn(n)
    if (!folio) return [{ text: 'Indicame el folio de la reserva (por ejemplo R-019).' }]
    return pickReservation(s, conv, 'reprogramar', folio)
  }
  const id = flow.data.id as string
  const res = byId(s.reservations, id)
  if (!res) {
    conv.flow = null
    return [{ text: 'No encuentro esa reserva.' }]
  }
  if (flow.step === 'confirm' && (payload === 'confirm' || (!payload && detectIntent(text) === 'yes'))) {
    const d = flow.data as any
    const r = bookingHandlers['res/reschedule'](s, { id, dateKey: d.dateKey, startMin: d.startMin, expectedVersion: res.version }, ctx)
    if (!r.ok) {
      d.alts = ((r.data as any)?.alternatives as number[]) ?? []
      flow.step = 'alt'
      return [{ text: r.message, actions: (d.alts as number[]).map((m) => A(hhmm(m), `alt:${m}`)) }]
    }
    conv.flow = null
    const nr = byId(s.reservations, id)!
    return [{ text: r.duplicate ? 'La reserva ya estaba en ese horario.' : `Listo: ${id} ahora es ${dayName(nr.dateKey)} ${Number(nr.dateKey.slice(8))} a las ${hhmm(nr.startMin)} (versión ${nr.version}). Es la misma reserva, no se creó otra.`, link: { label: 'Ver mi reserva', to: `/${biz.id}/reservas/${id}` } }]
  }
  if (flow.step === 'confirm' && (payload === 'deny' || detectIntent(text) === 'no')) {
    conv.flow = null
    return [{ text: `No cambié nada: ${id} sigue en su horario original.` }]
  }
  const d = flow.data as any
  if (payload?.startsWith('alt:')) {
    d.startMin = Number(payload.slice(4))
    d.dateKey = d.dateKey ?? res.dateKey
  } else {
    const within = (m: number) => slotInService(s, res.locationId, d.dateKey ?? res.dateKey, m, businessDuration(s, biz.id).service)
    const dt = parseDate(n, s.clock.nowMs, minutesOfDay(s.clock.nowMs))
    const tm = parseTime(n, within)
    if (dt?.dateKey) d.dateKey = dt.dateKey
    else if (dt?.candidate) d.dateKey = dt.candidate
    if (tm) d.startMin = tm.startMin
    if (!dt && !tm) return null
  }
  const dateKey = d.dateKey ?? res.dateKey
  const startMin = d.startMin ?? res.startMin
  d.dateKey = dateKey
  d.startMin = startMin
  const q = { businessId: biz.id, locationId: res.locationId, dateKey, startMin, party: res.party, sectorPref: res.sectorPref, excludeId: res.id }
  const { service } = businessDuration(s, biz.id)
  if (isPast(s, dateKey, startMin) || !slotInService(s, res.locationId, dateKey, startMin, service) || !slotAvailable(s, q)) {
    const alts = alternatives(s, q, 3)
    d.alts = alts
    flow.step = 'alt'
    return [{ text: alts.length ? `Ese horario no está disponible; tu reserva ${id} sigue como estaba. Puedo ofrecer ${alts.map(hhmm).join(' o ')} ese día.` : `Ese horario no está disponible y no veo otro ese día; ${id} sigue como estaba. Probemos otro día.`, actions: alts.map((m) => A(hhmm(m), `alt:${m}`)) }]
  }
  flow.step = 'confirm'
  return [{ text: `Pasaría ${id} al ${summarizeDay(dateKey)} a las ${hhmm(startMin)}. ¿Confirmás el cambio?`, actions: [A('Confirmar cambio', 'confirm'), A('Dejarla como está', 'deny')] }]
}

// ================================================================== pedidos (retiro por chat)
interface OData {
  itemId?: string
  qty: number
  selections: Record<string, string[]>
  locationId?: string
  startMin?: number
  alias?: string
  operationId: string
}

function matchItem(s: AppState, biz: BusinessProfile, n: string): MenuItem | null {
  const items = menuFor(s, biz.id)
  let best: MenuItem | null = null
  let bestLen = 0
  for (const it of items) {
    const nn = normalize(it.name).replace(/\(.*\)/, '').trim()
    if (nn && n.includes(nn) && nn.length > bestLen) {
      best = it
      bestLen = nn.length
    }
  }
  return best
}
function matchOptions(s: AppState, item: MenuItem, n: string, data: OData) {
  for (const g of groupsOf(s, item)) {
    for (const o of g.options) {
      const on = normalize(o.name).replace(/\(.*\)/, '').trim()
      const alt = normalize(o.name)
      const hit = n.includes(on) || n.includes(alt) || (g.id === 'MG-leche' && o.id === 'le-vegetal' && /\b(vegetal|avena|soja|almendra)\b/.test(n))
      if (hit && !(g.id === 'MG-tamano' && on === 'chico' && /chico/.test(on) === false)) {
        if (g.max === 1) data.selections[g.id] = [o.id]
        else data.selections[g.id] = Array.from(new Set([...(data.selections[g.id] ?? []), o.id])).slice(0, g.max)
      }
    }
  }
}
function parseQty(n: string): number {
  const m = /\b(\d{1,2})\b/.exec(n)
  if (m) return Math.min(Number(m[1]), 6)
  if (/\b(dos)\b/.test(n)) return 2
  if (/\b(tres)\b/.test(n)) return 3
  return 1
}

function orderStep(s: AppState, ctx: Ctx, conv: Conversation, biz: BusinessProfile, channel: Message['channel']): Reply[] {
  const flow = conv.flow!
  const d = flow.data as unknown as OData
  const item = byId(s.menuItems, d.itemId)!
  // grupos obligatorios
  for (const g of groupsOf(s, item)) {
    if (g.required && !(d.selections[g.id]?.length)) {
      flow.step = `grupo:${g.id}`
      return [{ text: `¿${g.name}?`, actions: g.options.map((o) => A(o.name, `pick:${g.id}:${o.id}`)) }]
    }
  }
  // sede
  const locs = s.locations.filter((l) => l.businessId === biz.id && l.pickupEnabled)
  if (!d.locationId) {
    const ok1 = locs.filter((l) => !itemUnavailable(s, item, l.id) || itemUnavailable(s, item, l.id) === 'agotado')
    if (locs.length === 1) d.locationId = locs[0].id
    else if (ok1.length === 1) d.locationId = ok1[0].id
    else {
      flow.step = 'sede'
      return [{ text: '¿En qué sede lo retirás?', actions: locs.map((l) => A(l.name, `sede:${l.id}`)) }]
    }
  }
  const un = itemUnavailable(s, item, d.locationId)
  if (un) {
    conv.flow = null
    return [{ text: `${item.name}: ${un === 'otra-sede' ? 'no se sirve en esa sede' : 'se agotó'}. Podés elegir otra opción en la carta.`, link: { label: 'Ver la carta', to: `/${biz.id}/carta` } }]
  }
  if (d.startMin === undefined) {
    flow.step = 'hora'
    const slots = pickupSlots(s, biz.id, d.locationId, 3)
    if (!slots.length) {
      conv.flow = null
      return [{ text: 'No quedan franjas de retiro hoy en el día simulado. Podés consultar la carta o intentar mañana.' }]
    }
    return [{ text: '¿A qué hora lo retirás?', actions: slots.map((m) => A(hhmm(m), `pickup:${m}`)) }]
  }
  const cu = byId(s.customers, conv.customerId)
  if (!cu && !d.alias) {
    flow.step = 'alias'
    return [{ text: '¿A nombre de quién lo dejo?' }]
  }
  const chk = checkLine(s, item, d.selections, d.qty)
  if (!chk.ok) {
    conv.flow = null
    return [{ text: `No pude armar el pedido: ${Object.values(chk.errors).join(' ')}` }]
  }
  const loc = byId(s.locations, d.locationId)!
  flow.step = 'confirm'
  const picks = chk.picked.map((p) => p.optionName.toLowerCase()).join(', ')
  return [
    {
      text: `${d.qty === 1 ? 'Un' : d.qty} ${item.name}${picks ? ` (${picks})` : ''}, sede ${loc.name}, retiro ${hhmm(d.startMin)}, total ${fmtARS(chk.unitCents * d.qty)}. ¿Confirmás el pedido?`,
      actions: [A('Confirmar pedido', 'confirm'), A('Cancelar', 'deny')],
    },
  ]
}

function submitOrder(s: AppState, ctx: Ctx, conv: Conversation, biz: BusinessProfile, channel: Message['channel']): Reply[] {
  const d = conv.flow!.data as unknown as OData
  let cu = byId(s.customers, conv.customerId)
  if (!cu && d.alias) {
    cu = ensureCustomer(s, ctx, biz.id, d.alias, { whatsapp: channel === 'whatsapp', voz: channel === 'voz' })
    conv.customerId = cu.id
  }
  const cartId = `CHATCART-${conv.id}`
  s.carts = s.carts.filter((c) => c.id !== cartId)
  const item = byId(s.menuItems, d.itemId)!
  const chk = checkLine(s, item, d.selections, d.qty)
  s.carts.push({
    id: cartId,
    businessId: biz.id,
    locationId: d.locationId!,
    customerId: cu?.id ?? null,
    lines: [{ id: nextId(s, 'CLN', 4), itemId: item.id, itemVersion: item.version, selections: d.selections, qty: d.qty, note: '', unitCentsSeen: chk.unitCents }],
    fulfillment: { kind: 'retiro', startMin: d.startMin! },
    alias: cu?.alias ?? d.alias ?? 'Invitado',
    version: 1,
    pendingOperationId: d.operationId,
    updatedAt: ctx.now,
  })
  const r = commerceHandlers['order/submit'](s, { cartId, operationId: d.operationId, channel: channel === 'voz' ? 'voz' : 'whatsapp', conversationId: conv.id, customerId: cu?.id ?? null }, ctx)
  s.carts = s.carts.filter((c) => c.id !== cartId)
  if (!r.ok) {
    if (r.code === 'franja-pasada' || r.code === 'retiro-lleno' || r.code === 'fuera-de-horario' || r.code === 'franja-invalida') {
      d.startMin = undefined
      conv.flow!.step = 'hora'
      return [{ text: r.message, actions: (((r.data as any)?.alternatives as number[]) ?? []).map((m) => A(hhmm(m), `pickup:${m}`)) }]
    }
    conv.flow = null
    return [{ text: r.message }]
  }
  const id = (r.data as { orderId: string }).orderId
  if (!conv.orderIds.includes(id)) conv.orderIds.push(id)
  conv.flow = null
  const link = { label: 'Ver mi pedido', to: `/${biz.id}/pedido/${id}` }
  if (r.duplicate) return [{ text: `Ese pedido ya existe como ${id}: abrí el registro existente, no creé otro.`, link }]
  return [{ text: `Listo: ${id} enviado a la barra. El equipo todavía debe aceptarlo.`, link }]
}

function flowOrder(s: AppState, ctx: Ctx, conv: Conversation, biz: BusinessProfile, text: string, payload: string | undefined, channel: Message['channel']): Reply[] | null {
  const flow = conv.flow!
  const d = flow.data as unknown as OData
  const n = normalize(text)
  if (payload?.startsWith('sede:')) d.locationId = payload.slice(5)
  else if (payload?.startsWith('pick:')) {
    const [, gid, oid] = payload.split(':')
    d.selections[gid] = [oid]
  } else if (payload?.startsWith('pickup:')) d.startMin = Number(payload.slice(7))
  else if (flow.step === 'alias') {
    if (!n) return [{ text: 'Necesito un nombre para el retiro.' }]
    d.alias = text.trim()
  } else if (flow.step === 'confirm') {
    if (payload === 'confirm' || (!payload && detectIntent(text) === 'yes')) return submitOrder(s, ctx, conv, biz, channel)
    if (payload === 'deny' || detectIntent(text) === 'no') {
      conv.flow = null
      return [{ text: 'No envié nada. Cuando quieras, pedime otra cosa.' }]
    }
    return null
  } else if (flow.step === 'hora') {
    const tm = parseTime(n, (m) => m >= 8 * 60 && m < 20 * 60)
    if (tm) d.startMin = tm.startMin
    else if (/\b(antes posible|ya|ahora)\b/.test(n)) d.startMin = pickupSlots(s, biz.id, d.locationId!, 1)[0]
    else return null
  } else {
    const item = byId(s.menuItems, d.itemId)!
    matchOptions(s, item, n, d)
    if (/\bcentro\b/.test(n)) d.locationId = s.locations.find((l) => l.businessId === biz.id && /centro/i.test(l.name))?.id
    if (/\bnorte\b/.test(n)) d.locationId = s.locations.find((l) => l.businessId === biz.id && /norte/i.test(l.name))?.id
  }
  return orderStep(s, ctx, conv, biz, channel)
}

function startOrder(s: AppState, ctx: Ctx, conv: Conversation, biz: BusinessProfile, n: string, channel: Message['channel']): Reply[] | null {
  const item = matchItem(s, biz, n)
  if (!item) return null
  const pickupAny = s.locations.some((l) => l.businessId === biz.id && l.pickupEnabled)
  if (!pickupAny) {
    return [{ text: `${item.name} se pide desde la carta, en la mesa. Por chat no tomo pedidos en este perfil.`, link: { label: 'Ver la carta', to: `/${biz.id}/carta` } }]
  }
  const d: OData = { itemId: item.id, qty: parseQty(n.replace(item.name.toLowerCase(), '')), selections: {}, operationId: nextId(s, 'OP', 4) }
  matchOptions(s, item, n, d)
  conv.flow = { type: 'pedido', step: 'start', data: d as unknown as Record<string, unknown> }
  return orderStep(s, ctx, conv, biz, channel)
}

// ================================================================== seguimiento
function statusReply(s: AppState, conv: Conversation, folio: string | null): Reply[] {
  if (folio?.startsWith('O-')) {
    const o = s.orders.find((x) => x.id === folio && x.businessId === conv.businessId)
    if (!o) return [{ text: `No encuentro el pedido ${folio} en este negocio. Revisá el folio.` }]
    if (o.conversationId !== conv.id) {
      o.conversationId = conv.id
      o.version++
    }
    if (!conv.orderIds.includes(o.id)) conv.orderIds.push(o.id)
    return [{ text: `Pedido ${o.id}: ${o.status.replace('_', ' ')}${o.status === 'listo' ? ` · retiralo con el código ${o.pickupCode}` : ''}. Lo enlacé a esta conversación (no creé otro).`, link: { label: 'Ver mi pedido', to: `/${conv.businessId}/pedido/${o.id}` } }]
  }
  if (folio?.startsWith('R-')) {
    const r = s.reservations.find((x) => x.id === folio && x.businessId === conv.businessId)
    if (!r) return [{ text: `No encuentro la reserva ${folio} en este negocio. Revisá el folio.` }]
    if (!conv.reservationIds.includes(r.id)) conv.reservationIds.push(r.id)
    return [{ text: `Reserva ${resLine(r)}.`, link: { label: 'Ver mi reserva', to: `/${conv.businessId}/reservas/${r.id}` } }]
  }
  const lastO = conv.orderIds[conv.orderIds.length - 1]
  const lastR = activeReservationsOf(s, conv)[0]
  if (lastO) return statusReply(s, conv, lastO)
  if (lastR) return statusReply(s, conv, lastR.id)
  return [{ text: 'Pasame el folio (por ejemplo O-013 o R-019) y te cuento cómo va.' }]
}

// ================================================================== dietario
function dietary(s: AppState, ctx: Ctx, conv: Conversation, biz: BusinessProfile, text: string, gluten: boolean): Reply[] {
  const flow = conv.flow
  if (flow?.type === 'reserva') (flow.data as unknown as RData).dietaryNote = text.trim()
  const linked = activeReservationsOf(s, conv).filter((r) => r.status === 'solicitada' || r.status === 'confirmada')
  let target: Reservation | undefined = linked.find((r) => r.status === 'solicitada') ?? linked[0]
  if (target) {
    target.dietaryNote = text.trim()
    target.reviewReason = 'alimentaria'
    target.reviewResolved = false
    if (target.status === 'solicitada') target.status = 'revision_humana'
    target.version++
    createTask(s, ctx, { businessId: biz.id, kind: 'alimentaria', entityType: 'Reservation', entityId: target.id, conversationId: conv.id, note: `Consulta alimentaria: “${text.trim()}”. Confirmar ingredientes y preparación; no se garantiza ausencia de alérgenos.` })
    audit(s, ctx, biz.id, 'reservation.reviewRequired', 'Reservation', target.id, `Reserva ${target.id} pasa a revisión humana por consulta alimentaria`)
    emit(ctx, { type: 'chat.humanReview', businessId: biz.id, entityType: 'Reservation', entityId: target.id, payload: { reason: 'alimentaria' } })
  } else {
    handoff(s, ctx, conv, `Consulta alimentaria: “${text.trim()}”.`, 'alimentaria', flow?.type === 'reserva' ? (flow.data as Record<string, unknown>) : undefined)
  }
  const base = gluten
    ? 'En la carta de muestra, cada plato trae una anotación alimentaria aportada por el negocio ficticio (por ejemplo “gluten”). Esta demo no puede garantizar ausencia de alérgenos: derivo la consulta al equipo de seguridad alimentaria.'
    : 'Voy a derivar tu consulta al equipo para que confirme ingredientes y preparación. Esta demo no puede garantizar ausencia de alérgenos'
  return [{ text: base + (target ? `. Tu reserva ${target.id} pasó a revisión humana y no se acepta automáticamente.` : '.'), link: target ? { label: 'Ver mi reserva', to: `/${biz.id}/reservas/${target.id}` } : undefined }]
}

// ================================================================== núcleo
function greeting(biz: BusinessProfile): Reply {
  const acts = [...(biz.reservationsEnabled ? [A('Reservar', 'intent:reserve')] : []), A('Ver la carta', 'intent:menu'), A('Seguir un pedido', 'intent:status')]
  return { text: `Hola, soy el asistente de ${biz.name} en esta demo. ¿Querés reservar, consultar la carta o seguir un pedido?`, actions: acts }
}

export function respond(s: AppState, ctx: Ctx, conv: Conversation, text: string, payload: string | undefined, channel: Message['channel']): Reply[] {
  const biz = byId(s.businesses, conv.businessId)!
  const n = normalize(text)
  const intent = payload?.startsWith('intent:') ? (payload.slice(7) === 'reserve' ? 'reserve' : payload.slice(7) === 'menu' ? 'menu' : payload.slice(7) === 'status' ? 'status' : payload.slice(7) === 'human' ? 'human' : 'unknown') : detectIntent(text)
  const isIntentPayload = !!payload?.startsWith('intent:')

  // Acciones directas desde recordatorios
  if (payload?.startsWith('attend:')) {
    const r = bookingHandlers['res/confirmAttendance'](s, { id: payload.slice(7) }, ctx)
    conv.failures = 0
    return [{ text: r.ok ? 'Gracias, avisé a recepción que vas. Te esperamos.' : r.message }]
  }
  if (payload?.startsWith('cancel:')) {
    conv.failures = 0
    return pickReservation(s, conv, 'cancelar', payload.slice(7))
  }

  // Flujos en curso
  if (conv.flow && !isIntentPayload) {
    const f = conv.flow
    // dietario siempre tiene prioridad (seguridad)
    if (intent === 'dietary' || intent === 'gluten') {
      conv.failures = 0
      return dietary(s, ctx, conv, byId(s.businesses, conv.businessId)!, text, intent === 'gluten')
    }
    let r: Reply[] | null = null
    if (f.type === 'reserva') r = flowReserve(s, ctx, conv, biz, text, payload, channel)
    else if (f.type === 'cancelar') r = flowCancel(s, ctx, conv, text, payload)
    else if (f.type === 'reprogramar') r = flowReschedule(s, ctx, conv, biz, text, payload)
    else if (f.type === 'pedido') r = flowOrder(s, ctx, conv, biz, text, payload, channel)
    else if (f.type === 'seguimiento') {
      const folio = folioIn(n)
      if (folio) {
        conv.flow = null
        r = statusReply(s, conv, folio)
      } else r = [{ text: 'No veo un folio. Escribilo así: O-013 (pedido) o R-019 (reserva).' }]
    }
    if (r) {
      conv.failures = 0
      return r
    }
    // el flujo no entendió: se cae a intención global
  }

  switch (intent) {
    case 'greeting':
      conv.failures = 0
      return [greeting(biz)]
    case 'gluten':
    case 'dietary':
      conv.failures = 0
      return dietary(s, ctx, conv, biz, text, intent === 'gluten')
    case 'human':
      conv.failures = 0
      handoff(s, ctx, conv, 'El cliente pidió hablar con el equipo.', 'fuera-de-alcance', { lastText: text })
      return [{ text: 'Listo, derivé tu consulta al equipo. Conservé el historial de esta conversación.' }]
    case 'cancel': {
      conv.failures = 0
      if (/\bpedido\b/.test(n)) {
        const o = [...conv.orderIds].reverse().map((id) => byId(s.orders, id)).find((x) => x && ['enviado', 'aceptado', 'en_preparacion', 'listo'].includes(x.status))
        if (!o) return [{ text: 'No encuentro un pedido activo para cancelar. Pasame el folio (por ejemplo O-013).' }]
        const r = commerceHandlers['order/cancel'](s, { orderId: o.id, reason: 'Cancelado por el cliente desde el chat' }, ctx)
        return [{ text: r.ok ? (r.message ?? `Pedido ${o.id} cancelado.`) : r.message }]
      }
      return pickReservation(s, conv, 'cancelar', folioIn(n)?.startsWith('R-') ? folioIn(n) : null)
    }
    case 'reschedule':
      conv.failures = 0
      return pickReservation(s, conv, 'reprogramar', folioIn(n)?.startsWith('R-') ? folioIn(n) : null)
    case 'reserve': {
      conv.failures = 0
      if (!biz.reservationsEnabled) {
        handoff(s, ctx, conv, 'Intención de reservar en un perfil que atiende por orden de llegada.', 'fuera-de-alcance', { lastText: text })
        return [{ text: 'En este perfil atendemos por orden de llegada: no tomamos reservas. Podés ver la carta o acercarte cuando quieras. Derivé tu consulta al equipo por si necesitás algo más.', link: { label: 'Ver la carta', to: `/${biz.id}/carta` } }]
      }
      const data = startReserve(s, conv, biz)
      if (!isIntentPayload) fillFromText(s, data, biz, n)
      return reserveStep(s, ctx, conv, biz)
    }
    case 'menu': {
      conv.failures = 0
      const cats = categoriesOf(menuFor(s, biz.id))
      return [{ text: `Tenemos ${cats.join(', ')}. Mirá la carta completa acá.`, link: { label: 'Ver la carta', to: `/${biz.id}/carta` } }]
    }
    case 'status': {
      conv.failures = 0
      const folio = folioIn(n)
      if (!folio && /\b(pedido)\b/.test(n) === false && !conv.orderIds.length && !activeReservationsOf(s, conv).length) {
        conv.flow = { type: 'seguimiento', step: 'folio', data: {} }
        return [{ text: 'Pasame el folio (por ejemplo O-013 o R-019) y te cuento cómo va.' }]
      }
      return statusReply(s, conv, folio)
    }
    case 'webdone': {
      conv.failures = 0
      conv.flow = { type: 'seguimiento', step: 'folio', data: {} }
      return [{ text: 'Perfecto, no lo repito. Pasame el folio del pedido (por ejemplo O-013) y lo enlazo a esta conversación.' }]
    }
    case 'order': {
      const r = startOrder(s, ctx, conv, biz, n, channel)
      if (r) {
        conv.failures = 0
        return r
      }
      break
    }
    case 'yes':
      if (conv.failures > 0) {
        conv.failures = 0
        handoff(s, ctx, conv, 'El cliente aceptó hablar con el equipo.', 'fuera-de-alcance', { lastText: text })
        return [{ text: 'Listo, derivé tu consulta al equipo. Conservé el historial de esta conversación.' }]
      }
      return [{ text: '¿Querés reservar, consultar la carta o seguir un pedido?', actions: greeting(biz).actions }]
    case 'thanks':
      conv.failures = 0
      return [{ text: '¡De nada! Si necesitás algo más, escribime.' }]
    default:
      break
  }
  // fallback
  if (payload === 'human') {
    handoff(s, ctx, conv, 'El cliente pidió hablar con el equipo.', 'fuera-de-alcance', { lastText: text })
    return [{ text: 'Listo, derivé tu consulta al equipo. Conservé el historial de esta conversación.' }]
  }
  conv.failures++
  if (conv.failures >= 2) {
    conv.failures = 0
    handoff(s, ctx, conv, `Consulta fuera de alcance: “${text.trim()}”.`, 'fuera-de-alcance', { lastText: text })
    return [{ text: `No logro ayudarte con eso, así que te derivo con el equipo. Conservé tu mensaje: “${text.trim()}”.` }]
  }
  return [
    {
      text: 'Puedo ayudarte con carta, reservas o seguimiento. ¿Querés hablar con el equipo?',
      actions: [A('Hablar con el equipo', 'human'), A('Ver la carta', 'intent:menu'), ...(biz.reservationsEnabled ? [A('Reservar', 'intent:reserve')] : [])],
    },
  ]
}

const chatSend: Handler = (s, c, ctx) => {
  const conv = byId(s.conversations, c.conversationId)
  if (!conv) return fail('conversacion-inexistente', 'Conversación inexistente.')
  ctx.correlationId = conv.correlationId
  const text = String(c.text ?? '').trim()
  if (!text) return fail('vacio', 'Escribí un mensaje para enviarlo.')
  const channel: Message['channel'] = c.channel ?? conv.channel
  addMessage(s, ctx, conv, { from: 'cliente', text, channel, status: 'entregado' })
  const replies = respond(s, ctx, conv, text, c.payload, channel)
  for (const r of replies) addMessage(s, ctx, conv, { from: 'asistente', text: r.text, channel, actions: r.actions, link: r.link })
  conv.version++
  return ok({ replies: replies.length })
}

const chatNew: Handler = (s, c, ctx) => {
  const biz = byId(s.businesses, c.businessId)
  if (!biz) return fail('negocio-inexistente', 'Negocio inexistente.')
  const customerId = c.customerId ?? s.session.customerByBusiness[biz.id] ?? null
  const id = nextId(s, 'C')
  const conv: Conversation = {
    id,
    ...base(s, biz.id),
    customerId,
    channel: c.channel ?? 'whatsapp',
    title: 'Conversación de demostración',
    flow: null,
    failures: 0,
    reservationIds: [],
    orderIds: [],
    correlationId: `COR-${id}`,
    handoff: false,
  }
  s.conversations.push(conv)
  audit(s, ctx, biz.id, 'conversation.created', 'Conversation', id, `Hilo ${id} creado`)
  return ok({ conversationId: id })
}

/** Cambio de canal: mismo hilo y mismo operationId; confirmar abre el registro existente. */
const chatContinue: Handler = (s, c, ctx) => {
  const r = byId(s.reservations, c.reservationId)
  if (!r) return fail('reserva-inexistente', 'Reserva inexistente.')
  let conv = byId(s.conversations, r.conversationId) ?? s.conversations.find((x) => x.businessId === r.businessId && x.customerId && x.customerId === r.customerId)
  if (!conv) {
    const o = chatNew(s, { businessId: r.businessId, customerId: r.customerId, channel: c.channel ?? 'whatsapp' }, ctx)
    if (!o.ok) return o
    conv = byId(s.conversations, (o.data as any).conversationId)!
  }
  r.conversationId = conv.id
  if (!conv.reservationIds.includes(r.id)) conv.reservationIds.push(r.id)
  conv.flow = {
    type: 'reserva',
    step: 'confirm',
    data: { party: r.party, dateKey: r.dateKey, startMin: r.startMin, operationId: r.operationId, reservationId: r.id, locationId: r.locationId } as unknown as Record<string, unknown>,
  }
  addMessage(s, ctx, conv, {
    from: 'asistente',
    text: `Seguimos tu solicitud ${r.id} por ${c.channel === 'voz' ? 'llamada' : 'WhatsApp'}. Serían ${r.party} personas el ${summarizeDay(r.dateKey)} a las ${hhmm(r.startMin)}. ¿Confirmás?`,
    channel: c.channel ?? 'whatsapp',
    actions: [A('Confirmar solicitud', 'confirm'), A('Cambiar', 'deny')],
    link: { label: 'Ver mi reserva', to: `/${r.businessId}/reservas/${r.id}` },
  })
  return ok({ conversationId: conv.id })
}

const chatReset: Handler = (s, c, ctx) => {
  const conv = byId(s.conversations, c.conversationId)
  if (!conv) return fail('conversacion-inexistente', 'Conversación inexistente.')
  const active = activeReservationsOf(s, conv).filter((r) => conv.reservationIds.includes(r.id))
  if (active.length && !c.keep) {
    return fail('reserva-activa', `Hay reservas vinculadas (${active.map((r) => r.id).join(', ')}). Reiniciar la conversación no las cancela: elegí conservarlas o cancelarlas por su flujo.`, { ids: active.map((r) => r.id) })
  }
  conv.flow = null
  conv.failures = 0
  conv.handoff = false
  audit(s, ctx, conv.businessId, 'conversation.reset', 'Conversation', conv.id, `Hilo ${conv.id} reiniciado; reservas conservadas: ${active.map((r) => r.id).join(', ') || 'ninguna'}`)
  return ok()
}

export const chatHandlers: Record<string, Handler> = {
  'chat/send': chatSend,
  'chat/new': chatNew,
  'chat/continue': chatContinue,
  'chat/reset': chatReset,
}
export type { Outcome }
export { getOrCreateCart }
