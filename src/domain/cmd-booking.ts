import { audit, base, byId, dup, emit, fail, nextId, normalize, ok, type Ctx, type Outcome } from './core'
import { ensureCustomer, findCustomerByAlias } from './customers'
import {
  alternatives,
  businessDuration,
  findFreeTable,
  isPast,
  slotAvailable,
  slotInService,
  tableBusy,
  tablesOf,
  windowsFor,
} from './availability'
import { createTask } from './tasks'
import { activeSessionAt, openSession } from './sessions'
import { hhmm, isValidDateKey } from './time'
import type { AppState, Reservation, WaitlistEntry } from './types'
import type { Handler } from './cmd-commerce'

const ACTIVE: Reservation['status'][] = ['solicitada', 'confirmada', 'alternativa_ofrecida', 'revision_humana', 'llegada']

function bumpReservation(r: Reservation) {
  r.version++
}

// ---------------------------------------------------------------- solicitud
export interface ReqParams {
  businessId: Reservation['businessId']
  locationId: string
  dateKey: string
  startMin: number
  party: number
  sectorPref?: Reservation['sectorPref']
  alias: string
  customerId?: string | null
  channel?: Reservation['channel']
  conversationId?: string | null
  operationId: string
  dietaryNote?: string | null
  notes?: string
}

const resRequest: Handler = (s, c: ReqParams, ctx) => {
  const existing = s.reservations.find((r) => r.operationId === c.operationId)
  if (existing) return dup({ reservationId: existing.id }, `Esa solicitud ya existe como ${existing.id}: se abre el registro existente.`)
  const biz = byId(s.businesses, c.businessId)
  const loc = byId(s.locations, c.locationId)
  if (!biz || !loc || loc.businessId !== biz.id) return fail('sede-invalida', 'La sede no corresponde al negocio.')
  if (!biz.reservationsEnabled) {
    return fail('sin-reservas', 'En este perfil atendemos por orden de llegada. No se toman reservas; podés consultar y ver la carta.')
  }
  if (!loc.hasTables) return fail('sin-mesas', 'Esta sede no tiene salón con mesas.')
  const alias = (c.alias ?? '').trim()
  if (!alias) return fail('alias-requerido', 'Poné un nombre para la reserva (alias de muestra).')
  if (!Number.isInteger(c.party) || c.party < 1) return fail('personas-invalidas', 'Indicá cuántas personas serán (al menos 1).')
  if (c.party > 40) return fail('personas-invalidas', 'Para más de 40 personas hablá con el equipo.')
  if (!isValidDateKey(c.dateKey)) return fail('fecha-invalida', 'La fecha no es válida.')
  const { service } = businessDuration(s, biz.id)
  const dietary = (c.dietaryNote ?? '').trim()
  const grande = c.party > biz.maxPartyAuto
  if (isPast(s, c.dateKey, c.startMin)) return fail('fecha-pasada', 'Esa fecha u hora ya pasó en el día simulado. Elegí otra franja.')
  if (!slotInService(s, c.locationId, c.dateKey, c.startMin, service)) {
    const open = windowsFor(s, c.locationId, c.dateKey)
    const txt = open.length ? `Atendemos ${open.map((w) => `${hhmm(w.startMin)}–${hhmm(w.endMin)}`).join(' y ')}; el servicio dura ${service} min.` : 'Ese día no hay servicio.'
    return fail('fuera-de-horario', `Fuera de horario. ${txt}`)
  }
  const needsReview = grande || !!dietary
  const q = { businessId: biz.id, locationId: c.locationId, dateKey: c.dateKey, startMin: c.startMin, party: c.party, sectorPref: c.sectorPref ?? 'cualquiera' }
  let table = null as ReturnType<typeof findFreeTable>
  if (!needsReview) {
    table = findFreeTable(s, q)
    if (!table) {
      const alts = alternatives(s, q, 3)
      return fail('sin-cupo', alts.length ? `No hay mesa para ${c.party} a las ${hhmm(c.startMin)}. Alternativas: ${alts.map(hhmm).join(', ')}.` : `No hay mesa para ${c.party} a las ${hhmm(c.startMin)} ni otra franja ese día. Podés anotarte en la lista de espera.`, {
        alternatives: alts,
      })
    }
  }
  // cliente
  let customerId = c.customerId ?? (c.channel === 'recepcion' ? null : s.session.customerByBusiness[biz.id]) ?? null
  if (!customerId && c.channel === 'recepcion') customerId = findCustomerByAlias(s, biz.id, alias)?.id ?? null
  else if (!customerId) {
    customerId = ensureCustomer(s, ctx, biz.id, alias, { whatsapp: c.channel === 'whatsapp', voz: c.channel === 'voz' }).id
    if (c.channel === 'web' || !c.channel) s.session.customerByBusiness[biz.id] = customerId
  }
  const auto = !needsReview && biz.autoConfirmReservations
  const res: Reservation = {
    id: nextId(s, 'R'),
    ...base(s, biz.id),
    locationId: c.locationId,
    dateKey: c.dateKey,
    startMin: c.startMin,
    party: c.party,
    status: needsReview ? 'revision_humana' : auto ? 'confirmada' : 'solicitada',
    tableId: auto ? table!.id : null,
    sectorPref: c.sectorPref ?? 'cualquiera',
    alias,
    customerId,
    channel: c.channel ?? 'web',
    conversationId: c.conversationId ?? null,
    operationId: c.operationId,
    correlationId: ctx.correlationId,
    dietaryNote: dietary || null,
    reviewReason: dietary ? 'alimentaria' : grande ? 'grupo-grande' : null,
    reviewResolved: false,
    alternativeStartMin: null,
    cancelReason: null,
    attendanceConfirmed: false,
    sessionId: null,
    notes: c.notes ?? '',
  }
  s.reservations.push(res)
  audit(s, ctx, biz.id, 'reservation.requested', 'Reservation', res.id, `Solicitud ${res.id}: ${c.party} pers. ${c.dateKey} ${hhmm(c.startMin)} (${res.status})`, c.operationId)
  if (needsReview) {
    createTask(s, ctx, {
      businessId: biz.id,
      kind: dietary ? 'alimentaria' : 'grupo-grande',
      entityType: 'Reservation',
      entityId: res.id,
      conversationId: res.conversationId,
      note: dietary
        ? `Consulta alimentaria (“${dietary}”). Confirmar ingredientes y preparación. No se garantiza ausencia de alérgenos.`
        : `Grupo de ${c.party} personas excede la mesa más grande (${biz.maxPartyAuto}). No se asigna mesa automáticamente.`,
      draft: { party: c.party, dateKey: c.dateKey, startMin: c.startMin },
    })
    emit(ctx, { type: 'reservation.reviewRequired', businessId: biz.id, entityType: 'Reservation', entityId: res.id })
  }
  emit(ctx, { type: 'reservation.requested', businessId: biz.id, entityType: 'Reservation', entityId: res.id })
  if (auto) emit(ctx, { type: 'reservation.confirmed', businessId: biz.id, entityType: 'Reservation', entityId: res.id })
  return ok({ reservationId: res.id, status: res.status })
}

// ---------------------------------------------------------------- aceptar / alternativas
const resAccept: Handler = (s, c, ctx) => {
  const r = byId(s.reservations, c.id)
  if (!r) return fail('reserva-inexistente', 'Reserva inexistente.')
  if (r.status === 'confirmada') return dup({ reservationId: r.id }, `${r.id} ya estaba confirmada.`)
  if (c.expectedVersion !== undefined && c.expectedVersion !== r.version) return fail('formulario-vencido', 'La reserva cambió mientras la mirabas. Actualizá la pantalla.')
  if (r.status === 'revision_humana' && !r.reviewResolved) {
    return fail('revision-pendiente', 'Esta reserva requiere revisión humana antes de aceptarla (la aceptación automática está bloqueada).')
  }
  if (!['solicitada', 'revision_humana'].includes(r.status)) return fail('estado-invalido', `Una reserva “${r.status}” no se acepta.`)
  if (r.party > (byId(s.businesses, r.businessId)?.maxPartyAuto ?? 8)) {
    return fail('grupo-grande', 'Grupo mayor a la mesa más grande: coordiná una solución manual con el cliente (no se asigna mesa).')
  }
  const q = { businessId: r.businessId, locationId: r.locationId, dateKey: r.dateKey, startMin: r.startMin, party: r.party, sectorPref: r.sectorPref, excludeId: r.id }
  if (isPast(s, r.dateKey, r.startMin)) return fail('fecha-pasada', 'La reserva ya pasó en el día simulado.')
  const table = findFreeTable(s, q)
  if (!table) {
    const alts = alternatives(s, q, 3)
    return fail('sin-disponibilidad', `Otro evento ocupó la mesa: ya no hay lugar a las ${hhmm(r.startMin)}.${alts.length ? ` Alternativas: ${alts.map(hhmm).join(', ')}.` : ''}`, { alternatives: alts })
  }
  r.tableId = table.id
  r.status = 'confirmada'
  bumpReservation(r)
  audit(s, ctx, r.businessId, 'reservation.confirmed', 'Reservation', r.id, `Reserva ${r.id} confirmada en mesa ${table.label}`, r.operationId, r.correlationId)
  emit(ctx, { type: 'reservation.confirmed', businessId: r.businessId, entityType: 'Reservation', entityId: r.id })
  return ok({ reservationId: r.id, tableId: table.id })
}

const resOfferAlt: Handler = (s, c, ctx) => {
  const r = byId(s.reservations, c.id)
  if (!r) return fail('reserva-inexistente', 'Reserva inexistente.')
  if (!['solicitada', 'revision_humana'].includes(r.status)) return fail('estado-invalido', `No se ofrece alternativa a una reserva “${r.status}”.`)
  const q = { businessId: r.businessId, locationId: r.locationId, dateKey: r.dateKey, startMin: c.startMin, party: r.party, sectorPref: r.sectorPref, excludeId: r.id }
  if (!slotAvailable(s, q)) return fail('sin-disponibilidad', `La franja ${hhmm(c.startMin)} no tiene cupo.`)
  r.alternativeStartMin = c.startMin
  r.status = 'alternativa_ofrecida'
  bumpReservation(r)
  audit(s, ctx, r.businessId, 'reservation.alternativeOffered', 'Reservation', r.id, `Alternativa ${hhmm(c.startMin)} ofrecida para ${r.id}`)
  return ok()
}

const resAcceptAlt: Handler = (s, c, ctx) => {
  const r = byId(s.reservations, c.id)
  if (!r) return fail('reserva-inexistente', 'Reserva inexistente.')
  if (r.status === 'confirmada') return dup()
  if (r.status !== 'alternativa_ofrecida' || r.alternativeStartMin === null) return fail('estado-invalido', 'No hay una alternativa pendiente.')
  const q = { businessId: r.businessId, locationId: r.locationId, dateKey: r.dateKey, startMin: r.alternativeStartMin, party: r.party, sectorPref: r.sectorPref, excludeId: r.id }
  const table = findFreeTable(s, q)
  if (!table || !slotAvailable(s, q)) return fail('sin-disponibilidad', 'La alternativa ya no tiene cupo. Pedí otra al equipo.')
  r.startMin = r.alternativeStartMin
  r.alternativeStartMin = null
  r.tableId = table.id
  r.status = 'confirmada'
  bumpReservation(r)
  audit(s, ctx, r.businessId, 'reservation.confirmed', 'Reservation', r.id, `Reserva ${r.id} confirmada en la alternativa ${hhmm(r.startMin)}`)
  emit(ctx, { type: 'reservation.confirmed', businessId: r.businessId, entityType: 'Reservation', entityId: r.id })
  return ok()
}

/** Reprogramación atómica: si el nuevo recurso no está disponible, queda el horario original. */
const resReschedule: Handler = (s, c, ctx) => {
  const r = byId(s.reservations, c.id)
  if (!r) return fail('reserva-inexistente', 'Reserva inexistente.')
  if (c.expectedVersion !== undefined && c.expectedVersion !== r.version) return fail('formulario-vencido', 'La reserva cambió mientras la editabas. Actualizá la pantalla.')
  if (!['solicitada', 'confirmada', 'alternativa_ofrecida'].includes(r.status)) return fail('estado-invalido', `Una reserva “${r.status}” no se reprograma.`)
  const dateKey = c.dateKey ?? r.dateKey
  const startMin = c.startMin ?? r.startMin
  const party = c.party ?? r.party
  if (dateKey === r.dateKey && startMin === r.startMin && party === r.party) return dup({ reservationId: r.id }, 'No hay cambios: la reserva sigue igual.')
  if (!isValidDateKey(dateKey)) return fail('fecha-invalida', 'La fecha no es válida.')
  const biz = byId(s.businesses, r.businessId)!
  const { service } = businessDuration(s, biz.id)
  if (isPast(s, dateKey, startMin)) return fail('fecha-pasada', 'Esa fecha u hora ya pasó en el día simulado.')
  if (!slotInService(s, r.locationId, dateKey, startMin, service)) return fail('fuera-de-horario', 'Fuera de horario de atención.')
  if (party > biz.maxPartyAuto) return fail('grupo-grande', 'Un grupo mayor a la mesa más grande requiere revisión humana: cancelá y consultá al equipo.')
  const q = { businessId: r.businessId, locationId: r.locationId, dateKey, startMin, party, sectorPref: r.sectorPref, excludeId: r.id }
  const table = findFreeTable(s, q) // se valida el nuevo recurso ANTES de liberar el original
  if (!table) {
    const alts = alternatives(s, q, 3)
    return fail('sin-disponibilidad', `Sin disponibilidad a las ${hhmm(startMin)}: tu reserva sigue en su horario original (${hhmm(r.startMin)}).${alts.length ? ` Probá: ${alts.map(hhmm).join(', ')}.` : ''}`, { alternatives: alts })
  }
  const from = `${r.dateKey} ${hhmm(r.startMin)}`
  r.dateKey = dateKey
  r.startMin = startMin
  r.party = party
  if (r.status === 'confirmada') r.tableId = table.id
  bumpReservation(r)
  audit(s, ctx, r.businessId, 'reservation.rescheduled', 'Reservation', r.id, `Reserva ${r.id} reprogramada ${from} → ${dateKey} ${hhmm(startMin)}`, c.operationId ?? null, r.correlationId)
  emit(ctx, { type: 'reservation.rescheduled', businessId: r.businessId, entityType: 'Reservation', entityId: r.id })
  return ok({ reservationId: r.id, version: r.version })
}

const resCancel: Handler = (s, c, ctx) => {
  const r = byId(s.reservations, c.id)
  if (!r) return fail('reserva-inexistente', 'Reserva inexistente.')
  if (r.status === 'cancelada') return dup({ reservationId: r.id }, `${r.id} ya estaba cancelada: el cupo se liberó una sola vez.`)
  if (!ACTIVE.includes(r.status)) return fail('estado-invalido', `Una reserva “${r.status}” ya no se puede cancelar.`)
  const reason = (c.reason ?? '').trim()
  if (!reason) return fail('motivo-requerido', 'Indicá el motivo de la cancelación.')
  const freed = r.tableId
  r.status = 'cancelada'
  r.cancelReason = reason
  r.tableId = null
  bumpReservation(r)
  audit(s, ctx, r.businessId, 'reservation.cancelled', 'Reservation', r.id, `Reserva ${r.id} cancelada: ${reason}`, null, r.correlationId)
  emit(ctx, { type: 'reservation.cancelled', businessId: r.businessId, entityType: 'Reservation', entityId: r.id, payload: { freedTableId: freed } })
  return ok({ reservationId: r.id })
}

const resArrive: Handler = (s, c, ctx) => {
  const r = byId(s.reservations, c.id)
  if (!r) return fail('reserva-inexistente', 'Reserva inexistente.')
  if (r.status === 'llegada') return dup()
  if (r.status !== 'confirmada') return fail('estado-invalido', 'Solo una reserva confirmada puede marcar llegada.')
  r.status = 'llegada'
  bumpReservation(r)
  audit(s, ctx, r.businessId, 'reservation.arrived', 'Reservation', r.id, `${r.alias} llegó (${r.id})`)
  return ok()
}

const resNoShow: Handler = (s, c, ctx) => {
  const r = byId(s.reservations, c.id)
  if (!r) return fail('reserva-inexistente', 'Reserva inexistente.')
  if (r.status === 'no_show') return dup()
  if (!['confirmada', 'llegada'].includes(r.status)) return fail('estado-invalido', 'Solo una reserva confirmada puede marcarse no-show.')
  r.status = 'no_show'
  r.tableId = null
  bumpReservation(r)
  audit(s, ctx, r.businessId, 'reservation.noShow', 'Reservation', r.id, `${r.id} marcada no-show`)
  emit(ctx, { type: 'reservation.cancelled', businessId: r.businessId, entityType: 'Reservation', entityId: r.id, payload: { freedTableId: null } })
  return ok()
}

const resResolveReview: Handler = (s, c, ctx) => {
  const r = byId(s.reservations, c.id)
  if (!r) return fail('reserva-inexistente', 'Reserva inexistente.')
  if (r.status !== 'revision_humana') return fail('estado-invalido', 'La reserva no está en revisión humana.')
  const note = (c.note ?? '').trim()
  if (!note) return fail('motivo-requerido', 'Anotá qué se revisó con el cliente.')
  r.reviewResolved = true
  if (r.reviewReason === 'grupo-grande') {
    return fail('grupo-grande', 'Este grupo supera la mesa más grande: coordinalo manualmente o cancelá la solicitud con un motivo.')
  }
  r.status = 'solicitada'
  bumpReservation(r)
  for (const t of s.tasks) {
    if (t.entityType === 'Reservation' && t.entityId === r.id && t.status === 'pendiente') {
      t.status = 'resuelta'
      t.resolution = note
      t.version++
    }
  }
  audit(s, ctx, r.businessId, 'reservation.reviewResolved', 'Reservation', r.id, `Revisión de ${r.id} resuelta: ${note}. Ahora puede aceptarse.`)
  return ok()
}

const resConfirmAttendance: Handler = (s, c, ctx) => {
  const r = byId(s.reservations, c.id)
  if (!r) return fail('reserva-inexistente', 'Reserva inexistente.')
  if (r.attendanceConfirmed) return dup()
  r.attendanceConfirmed = true
  bumpReservation(r)
  audit(s, ctx, r.businessId, 'reservation.attendanceConfirmed', 'Reservation', r.id, `Asistencia confirmada por el cliente (${r.id})`)
  return ok()
}

// ---------------------------------------------------------------- lista de espera
const waitAdd: Handler = (s, c, ctx) => {
  const ex = s.waitlist.find((w) => w.operationId === c.operationId)
  if (ex) return dup({ id: ex.id })
  const biz = byId(s.businesses, c.businessId)
  if (!biz?.reservationsEnabled) return fail('sin-reservas', 'En este perfil atendemos por orden de llegada.')
  const alias = (c.alias ?? '').trim()
  if (!alias) return fail('alias-requerido', 'Poné un nombre para la lista de espera.')
  if (!Number.isInteger(c.party) || c.party < 1 || c.party > biz.maxPartyAuto) return fail('personas-invalidas', `La lista de espera acepta grupos de 1 a ${biz.maxPartyAuto}.`)
  const w: WaitlistEntry = {
    id: nextId(s, 'W'),
    ...base(s, biz.id),
    locationId: c.locationId,
    dateKey: c.dateKey,
    startMin: c.startMin,
    party: c.party,
    alias,
    customerId: c.customerId ?? s.session.customerByBusiness[biz.id] ?? null,
    status: 'esperando',
    offerStartMin: null,
    offerExpiresAt: null,
    offerReservationVersionKey: null,
    operationId: c.operationId,
  }
  s.waitlist.push(w)
  audit(s, ctx, biz.id, 'waitlist.added', 'WaitlistEntry', w.id, `${alias} anotado en lista de espera (${c.party} pers. ${hhmm(c.startMin)})`, c.operationId)
  return ok({ id: w.id })
}
const waitCancel: Handler = (s, c, ctx) => {
  const w = byId(s.waitlist, c.id)
  if (!w) return fail('espera-inexistente', 'Entrada inexistente.')
  if (['cancelada', 'aceptada'].includes(w.status)) return dup()
  w.status = 'cancelada'
  w.version++
  audit(s, ctx, w.businessId, 'waitlist.cancelled', 'WaitlistEntry', w.id, `Lista de espera ${w.id} cancelada`)
  return ok()
}
const waitConfirm: Handler = (s, c, ctx) => {
  const w = byId(s.waitlist, c.id)
  if (!w) return fail('espera-inexistente', 'Entrada inexistente.')
  if (w.status === 'aceptada') return dup()
  if (w.status !== 'ofrecida' || w.offerStartMin === null) return fail('sin-oferta', 'No hay una oferta vigente para validar.')
  if (w.offerExpiresAt !== null && s.clock.nowMs > w.offerExpiresAt) {
    w.status = 'vencida'
    w.version++
    return { ok: false, code: 'oferta-vencida', message: 'La oferta venció por reloj; no se confirma sola.', commit: true }
  }
  const q = { businessId: w.businessId, locationId: w.locationId, dateKey: w.dateKey, startMin: w.offerStartMin, party: w.party, sectorPref: 'cualquiera' as const }
  const table = findFreeTable(s, q)
  if (!table) {
    w.status = 'retirada'
    w.version++
    audit(s, ctx, w.businessId, 'waitlist.offerWithdrawn', 'WaitlistEntry', w.id, `Oferta ${w.id} retirada: otra reserva ocupó el cupo`)
    return { ok: false, code: 'oferta-retirada', message: 'Otra reserva ocupó el cupo: la oferta se retiró (no se confirman dos grupos en la misma mesa).', commit: true }
  }
  const r = resRequest(
    s,
    {
      businessId: w.businessId,
      locationId: w.locationId,
      dateKey: w.dateKey,
      startMin: w.offerStartMin,
      party: w.party,
      alias: w.alias,
      customerId: w.customerId,
      channel: 'recepcion',
      operationId: `WAIT-${w.id}`,
    } as any,
    ctx,
  )
  if (!r.ok) return r
  const rid = (r.data as { reservationId: string }).reservationId
  const res = byId(s.reservations, rid)!
  if (res.status === 'solicitada') {
    res.status = 'confirmada'
    res.tableId = table.id
    res.version++
    emit(ctx, { type: 'reservation.confirmed', businessId: res.businessId, entityType: 'Reservation', entityId: res.id })
  }
  w.status = 'aceptada'
  w.version++
  audit(s, ctx, w.businessId, 'waitlist.accepted', 'WaitlistEntry', w.id, `Espera ${w.id} confirmada como ${rid}`)
  return ok({ reservationId: rid })
}

// ---------------------------------------------------------------- salón
const salonSeat: Handler = (s, c, ctx) => {
  const r = byId(s.reservations, c.reservationId)
  if (!r) return fail('reserva-inexistente', 'Reserva inexistente.')
  if (r.status === 'sentada') return dup({ sessionId: r.sessionId }, 'La reserva ya estaba sentada.')
  if (!['confirmada', 'llegada'].includes(r.status)) return fail('estado-invalido', `Solo se sienta una reserva confirmada o con llegada (estado actual: ${r.status}).`)
  const tableId = c.tableId ?? r.tableId
  const t = byId(s.tables, tableId)
  if (!t || t.locationId !== r.locationId) return fail('mesa-invalida', 'Elegí una mesa de esta sede.')
  if (t.seats < r.party) return fail('capacidad', `La mesa ${t.label} es de ${t.seats}; el grupo es de ${r.party}.`)
  const busy = activeSessionAt(s, t.id)
  if (busy) {
    const free = tablesOf(s, r.locationId).filter((x) => x.seats >= r.party && !activeSessionAt(s, x.id)).map((x) => x.label)
    return fail('mesa-ocupada', `La mesa ${t.label} ya está ocupada. ${free.length ? `Mesas libres compatibles: ${free.join(', ')}.` : 'No hay otra mesa libre compatible.'}`, { free })
  }
  const o = openSession(s, ctx, { businessId: r.businessId, locationId: r.locationId, kind: 'mesa', tableIds: [t.id], party: r.party, reservationId: r.id, label: `Mesa ${t.label} · ${r.alias}` })
  if (!o.ok) return o
  r.status = 'sentada'
  r.tableId = t.id
  r.sessionId = o.data!.id
  bumpReservation(r)
  audit(s, ctx, r.businessId, 'reservation.seated', 'Reservation', r.id, `${r.id} sentada en mesa ${t.label} (${o.data!.id})`)
  return ok({ sessionId: o.data!.id })
}

const salonOpen: Handler = (s, c, ctx) => {
  const biz = byId(s.businesses, c.businessId)
  if (!biz) return fail('negocio-inexistente', 'Negocio inexistente.')
  const ids: string[] = c.tableIds ?? []
  if (!ids.length) return fail('mesa-requerida', 'Elegí al menos una mesa.')
  const tables = ids.map((i) => byId(s.tables, i))
  if (tables.some((t) => !t || t.locationId !== c.locationId)) return fail('mesa-invalida', 'Mesa inexistente o de otra sede.')
  const party = c.party
  if (!Number.isInteger(party) || party < 1) return fail('personas-invalidas', 'Indicá cuántas personas son.')
  let seats = tables.reduce((a, t) => a + t!.seats, 0)
  if (ids.length > 1) {
    const rule = biz.combineRules.find((r) => r.tableIds.length === ids.length && r.tableIds.every((x) => ids.includes(x)))
    if (!rule) return fail('combinacion-no-permitida', 'Esa combinación de mesas no está en la regla de muestra del salón.')
    seats = rule.seats
  }
  if (party > seats) return fail('capacidad', `Capacidad ${seats}; el grupo es de ${party}.`)
  const o = openSession(s, ctx, {
    businessId: biz.id,
    locationId: c.locationId,
    kind: 'mesa',
    tableIds: ids,
    party,
    label: c.label ?? `Mesa ${tables.map((t) => t!.label).join('+')} · por orden de llegada`,
  })
  if (!o.ok) return o
  return ok({ sessionId: o.data!.id })
}

const salonMove: Handler = (s, c, ctx) => {
  const ses = byId(s.tableSessions, c.sessionId)
  if (!ses || ses.status !== 'activa') return fail('sesion-inexistente', 'La sesión no está activa.')
  const t = byId(s.tables, c.tableId)
  if (!t || t.locationId !== ses.locationId) return fail('mesa-invalida', 'Elegí una mesa de esta sede.')
  if (ses.tableIds.length === 1 && ses.tableIds[0] === t.id) return dup()
  const busy = activeSessionAt(s, t.id)
  if (busy) {
    const free = tablesOf(s, ses.locationId).filter((x) => x.seats >= ses.party && !activeSessionAt(s, x.id)).map((x) => x.label)
    return fail('mesa-ocupada', `No se puede mover: la mesa ${t.label} está ocupada. ${free.length ? `Libres: ${free.join(', ')}.` : ''} La sesión original queda intacta.`, { free })
  }
  if (ses.tableIds.length > 1) return fail('combinada', 'Una mesa combinada no se mueve; cerrala y abrí otra.')
  if (t.seats < ses.party) return fail('capacidad', `La mesa ${t.label} es de ${t.seats}; el grupo es de ${ses.party}.`)
  const was = ses.tableIds[0]
  ses.tableIds = [t.id]
  ses.version++
  if (ses.reservationId) {
    const r = byId(s.reservations, ses.reservationId)
    if (r) {
      r.tableId = t.id
      r.version++
    }
  }
  audit(s, ctx, ses.businessId, 'session.moved', 'TableSession', ses.id, `Sesión ${ses.id} movida ${was} → ${t.id}; cuenta e ítems conservados`)
  return ok()
}

export const bookingHandlers: Record<string, Handler> = {
  'res/request': resRequest,
  'res/accept': resAccept,
  'res/offerAlternative': resOfferAlt,
  'res/acceptAlternative': resAcceptAlt,
  'res/reschedule': resReschedule,
  'res/cancel': resCancel,
  'res/arrive': resArrive,
  'res/noShow': resNoShow,
  'res/resolveReview': resResolveReview,
  'res/confirmAttendance': resConfirmAttendance,
  'wait/add': waitAdd,
  'wait/cancel': waitCancel,
  'wait/confirm': waitConfirm,
  'salon/seat': salonSeat,
  'salon/open': salonOpen,
  'salon/move': salonMove,
}
export { normalize, tableBusy }
export type { Outcome, Ctx }
