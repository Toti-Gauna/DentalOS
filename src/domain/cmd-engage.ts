import { audit, base, byId, dup, emit, fail, nextId, ok } from './core'
import { ensureCustomer } from './customers'
import { PASSPORT_CARDS, PASSPORT_PICKS, STAMPS_FOR_BADGE } from './content'
import { dateKeyOf } from './time'
import type { AppState, BusinessId, Passport, TastingEvent } from './types'
import type { Handler } from './cmd-commerce'

// ---------------------------------------------------------------- clientes
const custConsent: Handler = (s, c, ctx) => {
  const cu = byId(s.customers, c.customerId)
  if (!cu) return fail('cliente-inexistente', 'Cliente inexistente.')
  const before = JSON.stringify(cu.consent)
  if (typeof c.service === 'boolean') cu.consent.service = c.service
  if (typeof c.promo === 'boolean') cu.consent.promo = c.promo
  if (JSON.stringify(cu.consent) === before) return dup()
  cu.consent.updatedAt = ctx.now
  cu.version++
  audit(s, ctx, cu.businessId, 'customer.consent', 'CustomerDemo', cu.id, `Consentimientos de ${cu.alias}: servicio=${cu.consent.service}, promo=${cu.consent.promo} (se tratan por separado)`)
  return ok()
}

const custUpdate: Handler = (s, c, ctx) => {
  const cu = byId(s.customers, c.customerId)
  if (!cu) return fail('cliente-inexistente', 'Cliente inexistente.')
  const p = c.patch ?? {}
  if ('prefs' in p) cu.prefs = String(p.prefs)
  if ('displayName' in p) {
    if (!String(p.displayName).trim()) return fail('validacion', 'El nombre ficticio no puede quedar vacío.')
    cu.displayName = String(p.displayName).trim()
  }
  cu.version++
  audit(s, ctx, cu.businessId, 'customer.updated', 'CustomerDemo', cu.id, `Ficha de ${cu.alias} actualizada`)
  return ok()
}

const custMerge: Handler = (s, c, ctx) => {
  if (c.confirm !== true) return fail('confirmacion-requerida', 'Unir clientes necesita tu confirmación explícita.')
  const keep = byId(s.customers, c.keepId)
  const drop = byId(s.customers, c.dropId)
  if (!keep || !drop || keep.id === drop.id) return fail('cliente-inexistente', 'Elegí dos clientes distintos.')
  if (keep.businessId !== drop.businessId) return fail('negocio-distinto', 'No se unen clientes de negocios distintos.')
  if (drop.mergedInto) return dup({}, `${drop.alias} ya estaba unido.`)
  for (const r of s.reservations) if (r.customerId === drop.id) (r.customerId = keep.id), r.version++
  for (const o of s.orders) if (o.customerId === drop.id) (o.customerId = keep.id), o.version++
  for (const cv of s.conversations) if (cv.customerId === drop.id) cv.customerId = keep.id
  for (const v of s.visits) if (v.customerId === drop.id) v.customerId = keep.id
  for (const w of s.waitlist) if (w.customerId === drop.id) w.customerId = keep.id
  for (const b of s.eventBookings) {
    if (b.customerId !== drop.id) continue
    const clash = s.eventBookings.find((x) => x.eventId === b.eventId && x.customerId === keep.id && ['inscripto', 'espera', 'oferta'].includes(x.status))
    if (clash && ['inscripto', 'espera', 'oferta'].includes(b.status)) b.status = 'cancelado'
    b.customerId = keep.id
  }
  keep.consent.promo = keep.consent.promo && drop.consent.promo // criterio conservador: la baja de uno prevalece
  keep.consent.service = keep.consent.service && drop.consent.service
  keep.consent.updatedAt = ctx.now
  keep.prefs = [keep.prefs, drop.prefs].filter(Boolean).join(' · ')
  keep.possibleDuplicateOf = null
  keep.version++
  drop.mergedInto = keep.id
  drop.possibleDuplicateOf = null
  drop.version++
  audit(s, ctx, keep.businessId, 'customer.merged', 'CustomerDemo', keep.id, `${drop.alias} (${drop.id}) unido a ${keep.alias} (${keep.id}) con confirmación local`)
  return ok()
}

// ---------------------------------------------------------------- pasaporte
export function getPassport(s: AppState, businessId: BusinessId, customerId: string | null): Passport | undefined {
  return s.passports.find((p) => p.businessId === businessId && p.customerId === customerId)
}
function ensurePassport(s: AppState, businessId: BusinessId, customerId: string | null): Passport {
  let p = getPassport(s, businessId, customerId)
  if (!p) {
    p = {
      id: nextId(s, 'PP'),
      ...base(s, businessId),
      customerId,
      cards: {},
      badge: 'sin-empezar',
      savedPreference: null,
      metrics: { started: 0, completed: 0, saved: 0, usedInCart: 0 },
    }
    s.passports.push(p)
  }
  return p
}
const cardsOf = (businessId: BusinessId) => PASSPORT_CARDS.filter((c) => c.businessId === businessId)
export function passportDone(s: AppState, p: Passport): number {
  return Object.values(p.cards).filter((c) => c.done).length
}
function recomputeBadge(p: Passport, businessId: BusinessId) {
  const n = Object.values(p.cards).filter((c) => c.done).length
  const total = cardsOf(businessId).length
  if (p.badge === 'guardada' || p.badge === 'reiniciada') {
    if (n === 0) return
    if (p.badge === 'guardada') return
  }
  p.badge = n === 0 ? 'sin-empezar' : n >= total ? 'disponible' : 'en-curso'
}

const passAnswer: Handler = (s, c, ctx) => {
  const card = cardsOf(c.businessId).find((x) => x.id === c.cardId)
  if (!card) return fail('tarjeta-inexistente', 'Tarjeta inexistente en este perfil.')
  if (byId(s.businesses, c.businessId)?.passportPaused) return fail('mecanica-pausada', 'La mecánica del pasaporte está pausada por el encargado. Podés seguir usando la carta.')
  const customerId = s.session.customerByBusiness[c.businessId as BusinessId] ?? null
  const p = ensurePassport(s, c.businessId, customerId)
  const prog = p.cards[card.id]
  if (prog?.done) return dup({ correct: prog.correct, explanation: card.explanation }, 'Esta tarjeta ya cuenta: no suma dos veces.')
  const first = Object.keys(p.cards).length === 0
  const opt = card.options.find((o) => o.id === c.optionId)
  if (!opt) return fail('opcion-invalida', 'Elegí una de las opciones.')
  const cur = (p.cards[card.id] ??= { done: false, attempts: 0, correct: false })
  cur.attempts++
  if (first) p.metrics.started++
  if (opt.correct) {
    cur.done = true
    cur.correct = true
  }
  const wasAvail = p.badge
  recomputeBadge(p, c.businessId)
  if (p.badge === 'disponible' && wasAvail !== 'disponible') p.metrics.completed++
  p.version++
  audit(s, ctx, c.businessId, 'passport.answer', 'Passport', p.id, `Tarjeta ${card.id}: ${opt.correct ? 'correcta' : 'reintento sin penalización'}`)
  return ok({ correct: opt.correct, explanation: card.explanation })
}

const passRead: Handler = (s, c, ctx) => {
  const card = cardsOf(c.businessId).find((x) => x.id === c.cardId)
  if (!card) return fail('tarjeta-inexistente', 'Tarjeta inexistente en este perfil.')
  if (byId(s.businesses, c.businessId)?.passportPaused) return fail('mecanica-pausada', 'La mecánica del pasaporte está pausada.')
  const customerId = s.session.customerByBusiness[c.businessId as BusinessId] ?? null
  const p = ensurePassport(s, c.businessId, customerId)
  if (p.cards[card.id]?.done) return dup()
  if (Object.keys(p.cards).length === 0) p.metrics.started++
  const cur = (p.cards[card.id] ??= { done: false, attempts: 0, correct: false })
  cur.done = true
  const was = p.badge
  recomputeBadge(p, c.businessId)
  if (p.badge === 'disponible' && was !== 'disponible') p.metrics.completed++
  p.version++
  audit(s, ctx, c.businessId, 'passport.read', 'Passport', p.id, `Tarjeta ${card.id} leída (sin pregunta)`)
  return ok()
}

const passSave: Handler = (s, c, ctx) => {
  const customerId = s.session.customerByBusiness[c.businessId as BusinessId] ?? null
  const p = getPassport(s, c.businessId, customerId)
  if (!p || (p.badge !== 'disponible' && p.badge !== 'guardada')) return fail('insignia-no-disponible', 'Completá las tres tarjetas para guardar tu selección.')
  if (!PASSPORT_PICKS[c.businessId as BusinessId].some((x) => x.id === c.itemId)) return fail('seleccion-invalida', 'Elegí una de las opciones propuestas.')
  if (p.badge === 'guardada' && p.savedPreference === c.itemId) return dup()
  p.savedPreference = c.itemId
  if (p.badge !== 'guardada') p.metrics.saved++
  p.badge = 'guardada'
  p.version++
  audit(s, ctx, c.businessId, 'passport.saved', 'Passport', p.id, `Selección guardada: ${c.itemId}. Sin premio ni descuento.`)
  return ok()
}

const passReset: Handler = (s, c, ctx) => {
  const customerId = s.session.customerByBusiness[c.businessId as BusinessId] ?? null
  const p = getPassport(s, c.businessId, customerId)
  if (!p) return dup()
  p.cards = {}
  p.savedPreference = null
  p.badge = 'reiniciada'
  p.version++
  audit(s, ctx, c.businessId, 'passport.reset', 'Passport', p.id, 'Pasaporte reiniciado por el cliente')
  return ok()
}

// ---------------------------------------------------------------- visitas / sellos
export function stampsOf(s: AppState, customerId: string): number {
  return new Set(s.visits.filter((v) => v.customerId === customerId && v.status === 'acreditada').map((v) => v.dateKey)).size
}

const visitCredit: Handler = (s, c, ctx) => {
  const biz = byId(s.businesses, c.businessId)
  if (!biz) return fail('negocio-inexistente', 'Negocio inexistente.')
  if (biz.passportPaused) return fail('mecanica-pausada', 'La mecánica de sellos está pausada.')
  const cu = byId(s.customers, c.customerId)
  if (!cu || cu.businessId !== biz.id) return fail('cliente-inexistente', 'Cliente inexistente en este negocio.')
  const dateKey = c.dateKey ?? dateKeyOf(s.clock.nowMs)
  const same = s.visits.find((v) => v.customerId === cu.id && v.dateKey === dateKey && v.locationId === c.locationId && v.status === 'acreditada')
  if (same) return dup({ visitId: same.id }, 'Ya hay un sello de esta persona para esa fecha y sede: el evento repetido no suma.')
  const otherLoc = s.visits.find((v) => v.customerId === cu.id && v.dateKey === dateKey && v.status === 'acreditada')
  if (otherLoc) return fail('sello-diario', 'Criterio conservador: un sello por persona y fecha en todo el negocio (evita acumular entre sedes). Ya hay uno ese día.')
  const v = {
    id: nextId(s, 'V'),
    ...base(s, biz.id),
    locationId: c.locationId,
    customerId: cu.id,
    dateKey,
    status: 'acreditada' as const,
    creditedBy: ctx.actor === 'sistema' ? ('encargado' as const) : ctx.actor,
    reversalReason: null,
  }
  s.visits.push(v)
  audit(s, ctx, biz.id, 'visit.credited', 'Visit', v.id, `Sello de muestra para ${cu.alias} (${dateKey}). Total ${stampsOf(s, cu.id)}. Sin premio real.`)
  emit(ctx, { type: 'visit.credited', businessId: biz.id, entityType: 'Visit', entityId: v.id })
  return ok({ visitId: v.id, stamps: stampsOf(s, cu.id), badge: stampsOf(s, cu.id) >= STAMPS_FOR_BADGE })
}

const visitRevert: Handler = (s, c, ctx) => {
  const v = byId(s.visits, c.visitId)
  if (!v) return fail('visita-inexistente', 'Visita inexistente.')
  if (v.status === 'revertida') return dup()
  const reason = (c.reason ?? '').trim()
  if (!reason) return fail('motivo-requerido', 'La reversión necesita un motivo.')
  v.status = 'revertida'
  v.reversalReason = reason
  v.version++
  audit(s, ctx, v.businessId, 'visit.reverted', 'Visit', v.id, `Sello ${v.id} revertido: ${reason} (el historial se conserva)`)
  return ok({ stamps: stampsOf(s, v.customerId) })
}

const passPause: Handler = (s, c, ctx) => {
  const b = byId(s.businesses, c.businessId)
  if (!b) return fail('negocio-inexistente', 'Negocio inexistente.')
  b.passportPaused = !!c.paused
  b.version++
  audit(s, ctx, b.id, 'passport.paused', 'BusinessProfile', b.id, `Mecánica de pasaporte/sellos ${b.passportPaused ? 'pausada' : 'activa'}`)
  return ok()
}

// ---------------------------------------------------------------- catas
export function eventSeats(s: AppState, e: TastingEvent) {
  const held = s.eventBookings.filter((b) => b.eventId === e.id && (b.status === 'inscripto' || b.status === 'oferta')).length
  return { held, free: Math.max(0, e.capacity - held) }
}

const eventEnroll: Handler = (s, c, ctx) => {
  const ex = s.eventBookings.find((b) => b.operationId === c.operationId)
  if (ex) return dup({ bookingId: ex.id })
  const e = byId(s.tastingEvents, c.eventId)
  if (!e || e.status !== 'abierta') return fail('evento-inexistente', 'La cata no está disponible.')
  let customerId: string | null = c.customerId ?? s.session.customerByBusiness[e.businessId] ?? null
  let alias = c.alias as string | undefined
  if (!customerId) {
    if (!alias?.trim()) return fail('alias-requerido', 'Poné un nombre para inscribirte (alias de muestra).')
    customerId = ensureCustomer(s, ctx, e.businessId, alias).id
    s.session.customerByBusiness[e.businessId] = customerId
  }
  const cu = byId(s.customers, customerId)!
  const already = s.eventBookings.find((b) => b.eventId === e.id && b.customerId === cu.id && ['inscripto', 'espera', 'oferta'].includes(b.status))
  if (already) return dup({ bookingId: already.id }, `${cu.alias} ya figura en esta cata (${already.status}): no se duplica.`)
  const { free } = eventSeats(s, e)
  if (free <= 0 && !c.joinWaitlist) return fail('cupo-lleno', 'No quedan lugares. Podés anotarte en la lista de espera.', { canWait: true })
  const b = {
    id: nextId(s, 'EB'),
    ...base(s, e.businessId),
    eventId: e.id,
    customerId: cu.id,
    alias: cu.alias,
    status: free > 0 ? ('inscripto' as const) : ('espera' as const),
    operationId: c.operationId,
    offerExpiresAt: null,
  }
  s.eventBookings.push(b)
  audit(s, ctx, e.businessId, 'event.enrolled', 'EventBooking', b.id, `${cu.alias}: ${b.status} en “${e.title}”`, c.operationId)
  return ok({ bookingId: b.id, status: b.status })
}

const eventCancel: Handler = (s, c, ctx) => {
  const b = byId(s.eventBookings, c.bookingId)
  if (!b) return fail('inscripcion-inexistente', 'Inscripción inexistente.')
  if (b.status === 'cancelado' || b.status === 'vencida') return dup({}, 'La inscripción ya estaba cancelada: el lugar se liberó una sola vez.')
  const freed = b.status === 'inscripto' || b.status === 'oferta'
  b.status = 'cancelado'
  b.version++
  audit(s, ctx, b.businessId, 'event.cancelled', 'EventBooking', b.id, `Inscripción ${b.id} cancelada`)
  if (freed) emit(ctx, { type: 'event.cancelled', businessId: b.businessId, entityType: 'EventBooking', entityId: b.id, payload: { eventId: b.eventId } })
  return ok()
}

const eventAcceptOffer: Handler = (s, c, ctx) => {
  const b = byId(s.eventBookings, c.bookingId)
  if (!b) return fail('inscripcion-inexistente', 'Inscripción inexistente.')
  if (b.status === 'inscripto') return dup()
  if (b.status !== 'oferta') return fail('sin-oferta', 'No hay una oferta vigente.')
  if (b.offerExpiresAt !== null && s.clock.nowMs > b.offerExpiresAt) {
    b.status = 'vencida'
    b.version++
    return { ok: false, code: 'oferta-vencida', message: 'La oferta venció por reloj; no se confirma sola.', commit: true }
  }
  b.status = 'inscripto'
  b.offerExpiresAt = null
  b.version++
  audit(s, ctx, b.businessId, 'event.offerAccepted', 'EventBooking', b.id, `${b.alias} aceptó el lugar liberado`)
  return ok()
}

export const engageHandlers: Record<string, Handler> = {
  'cust/consent': custConsent,
  'cust/update': custUpdate,
  'cust/merge': custMerge,
  'pass/answer': passAnswer,
  'pass/read': passRead,
  'pass/save': passSave,
  'pass/reset': passReset,
  'pass/pause': passPause,
  'visit/credit': visitCredit,
  'visit/revert': visitRevert,
  'event/enroll': eventEnroll,
  'event/cancel': eventCancel,
  'event/acceptOffer': eventAcceptOffer,
}
