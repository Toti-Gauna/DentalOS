import { audit, base, byId, dup, emit, fail, nextId, ok, type Ctx, type DomainEvent, type Outcome } from './core'
import { findFreeTable, reservationStartMs } from './availability'
import { addMessage, conversationOfCustomer } from './messaging'
import { createTask } from './tasks'
import { eventSeats } from './cmd-engage'
import { fmtDateShort, hhmm, HOUR, MINUTE } from './time'
import type {
  AppState,
  AutomationRule,
  AutomationRun,
  BusinessId,
  Conversation,
  CustomerDemo,
  Message,
  Order,
  Reservation,
} from './types'
import type { Handler } from './cmd-commerce'

export const OFFER_TTL_MIN = 30
export const EVENT_OFFER_TTL_MIN = 60
export const REMINDER_LEAD_MS = 2 * HOUR

export const RULE_DEFS: Omit<AutomationRule, 'businessId' | 'createdAt' | 'version' | 'id' | 'enabled' | 'failNext'>[] = [
  { code: 'AU01', name: 'Solicitud de reserva desde web/chat', channel: 'web/chat · comensal', trigger: 'Confirmar resumen con datos completos y cupo', action: 'Crear una solicitud y AutomationRun; enlazar hilo', config: {} },
  { code: 'AU02', name: 'Confirmación por WhatsApp', channel: 'WhatsApp · recepción', trigger: 'Reserva aceptada; canal autorizado', action: 'Encolar confirmación simulada con versión', config: {} },
  { code: 'AU03', name: 'Recordatorio T−2 h', channel: 'WhatsApp · comensal', trigger: 'El reloj cruza T−2 h con reserva activa y permiso de servicio', action: 'Recordatorio local con Confirmar/Cancelar', config: { leadHours: 2 } },
  { code: 'AU04', name: 'Oferta desde lista de espera', channel: 'web/chat · lista de espera', trigger: 'Una cancelación libera cupo compatible', action: 'Proponer alternativa al primer candidato (vence por reloj)', config: { ttlMin: OFFER_TTL_MIN } },
  { code: 'AU05', name: 'Aviso de pedido listo', channel: 'pedido · barra', trigger: 'KDS cambia a listo', action: 'Encolar aviso y actualizar seguimiento', config: {} },
  { code: 'AU06', name: 'Alerta de stock', channel: 'stock · encargado', trigger: 'Un insumo llega al umbral o se agota', action: 'Alerta e incidencia; ítems afectados se pausan por falta de insumo', config: {} },
  { code: 'AU07', name: 'Tarea de revisión humana', channel: 'chat/voz · recepción', trigger: 'Preferencia alimentaria o mensaje fuera de alcance', action: 'Crear tarea humana ligada a hilo/reserva', config: {} },
  { code: 'AU08', name: 'Sello de pasaporte', channel: 'pasaporte · cliente', trigger: 'Visita de muestra completada, una por fecha', action: 'Sello único + audit; insignia al cumplir reglas', config: {} },
  { code: 'AU09', name: 'Lugar liberado en cata', channel: 'evento · encargado', trigger: 'Inscripción cancelada con lista de espera', action: 'Liberar lugar y ofrecer al siguiente', config: { ttlMin: EVENT_OFFER_TTL_MIN } },
  { code: 'AU10', name: 'Vista previa de promoción', channel: 'promoción · cliente', trigger: 'Campaña de muestra manual con consentimiento promocional', action: 'Solo vista previa, registro local de simulación', config: {} },
]

export function ruleOf(s: AppState, businessId: BusinessId, code: string): AutomationRule | undefined {
  return s.rules.find((r) => r.businessId === businessId && r.code === code)
}

function runKey(rule: AutomationRule, entityType: string, entityId: string, entityVersion: number, trigger: string) {
  return `${rule.code}:v${rule.version}:${entityType}:${entityId}:v${entityVersion}:${trigger}`
}

function startRun(
  s: AppState,
  ctx: Ctx,
  rule: AutomationRule,
  entityType: string,
  entityId: string,
  entityVersion: number,
  trigger: string,
): { run: AutomationRun; created: boolean } | null {
  const key = runKey(rule, entityType, entityId, entityVersion, trigger)
  const ex = s.runs.find((r) => r.key === key)
  if (ex) return { run: ex, created: false }
  if (!rule.enabled) {
    audit(s, ctx, rule.businessId, 'automation.skipped', entityType, entityId, `${rule.code} pausada: no se ejecuta para ${entityId}`)
    return null
  }
  const run: AutomationRun = {
    id: nextId(s, 'RUN', 4),
    ...base(s, rule.businessId),
    ruleId: rule.id,
    ruleCode: rule.code,
    ruleVersion: rule.version,
    key,
    entityType,
    entityId,
    entityVersion,
    status: 'pendiente',
    attempts: 0,
    messageId: null,
    detail: '',
    log: [{ at: ctx.now, text: `Disparador ${trigger}` }],
    correlationId: ctx.correlationId,
  }
  s.runs.push(run)
  return { run, created: true }
}
const log = (run: AutomationRun, ctx: Ctx, text: string) => run.log.push({ at: ctx.now, text })

/** Entrega simulada: respeta fallo inyectado; no duplica mensaje (misma messageKey). */
function deliver(
  s: AppState,
  ctx: Ctx,
  rule: AutomationRule,
  run: AutomationRun,
  conv: Conversation,
  msg: { text: string; actions?: Message['actions']; link?: Message['link'] },
) {
  run.attempts++
  const failing = rule.failNext
  if (failing) rule.failNext = false
  const m = addMessage(s, ctx, conv, {
    from: 'sistema',
    text: msg.text,
    channel: 'whatsapp',
    status: failing ? 'fallido' : 'enviado',
    actions: msg.actions,
    link: msg.link,
    messageKey: run.key,
  })
  run.messageId = m.id
  if (failing) {
    run.status = 'fallida'
    run.detail = 'Fallo de entrega inyectado (demo). Reintentá la misma ejecución.'
    log(run, ctx, 'Error de entrega simulado')
    m.status = 'fallido'
    m.sentAt = null
  } else {
    run.status = run.status === 'fallida' ? 'recuperada' : 'ejecutada'
    run.detail = 'Entrega simulada: no se envió ningún mensaje real.'
    log(run, ctx, 'Mensaje simulado enviado')
    m.status = 'enviado'
    m.sentAt = ctx.now
  }
}

function customerOf(s: AppState, id: string | null): CustomerDemo | undefined {
  return byId(s.customers, id)
}
function convFor(s: AppState, businessId: string, convId: string | null, customerId: string | null): Conversation | undefined {
  return byId(s.conversations, convId) ?? conversationOfCustomer(s, businessId, customerId)
}

function whatsappTarget(s: AppState, r: { businessId: BusinessId; customerId: string | null; conversationId: string | null }) {
  const cu = customerOf(s, r.customerId)
  if (!cu) return { reason: 'sin-cliente' as const }
  if (!cu.consent.service) return { reason: 'sin-consentimiento' as const, cu }
  const conv = convFor(s, r.businessId, r.conversationId, r.customerId)
  if (!cu.channels.whatsapp || !conv) return { reason: 'canal-desconocido' as const, cu }
  return { conv, cu }
}

// ---------------------------------------------------------------- AU01
function au01(s: AppState, ctx: Ctx, ev: DomainEvent) {
  const r = byId(s.reservations, ev.entityId)
  const rule = ruleOf(s, ev.businessId, 'AU01')
  if (!r || !rule || r.channel === 'recepcion') return
  const st = startRun(s, ctx, rule, 'Reservation', r.id, 0, 'requested')
  if (!st?.created) return
  st.run.status = 'ejecutada'
  st.run.detail = `Solicitud ${r.id} creada${r.conversationId ? ` y enlazada al hilo ${r.conversationId}` : ''}.`
  log(st.run, ctx, st.run.detail)
  st.run.attempts = 1
}

// ---------------------------------------------------------------- AU02
function confirmationText(s: AppState, r: Reservation, updated: boolean) {
  const t = byId(s.tables, r.tableId)
  return `${updated ? 'Tu reserva fue reprogramada' : 'Tu reserva fue confirmada'}: ${r.id} · ${r.party} personas · ${fmtDateShort(r.dateKey)} a las ${hhmm(r.startMin)}${t ? ` · ${t.sector === 'terraza' ? 'terraza' : 'salón'} (el sector no está garantizado)` : ''}.`
}
function au02(s: AppState, ctx: Ctx, r: Reservation, updated: boolean) {
  const rule = ruleOf(s, r.businessId, 'AU02')
  if (!rule) return
  const st = startRun(s, ctx, rule, 'Reservation', r.id, r.version, updated ? 'rescheduled' : 'confirmed')
  if (!st?.created) return
  const { run } = st
  const tgt = whatsappTarget(s, r)
  if (!('conv' in tgt)) {
    run.status = tgt.reason === 'sin-consentimiento' || tgt.reason === 'sin-cliente' ? 'omitida' : 'derivada'
    run.detail =
      tgt.reason === 'sin-consentimiento'
        ? 'Sin consentimiento de servicio: no se envía.'
        : tgt.reason === 'canal-desconocido'
          ? 'Teléfono/canal desconocido: se deriva a recepción.'
          : 'Reserva cargada por recepción sin canal digital: no hay mensaje que enviar.'
    log(run, ctx, run.detail)
    if (tgt.reason === 'sin-cliente') return
    if (tgt.reason !== 'sin-consentimiento') {
      createTask(s, ctx, { businessId: r.businessId, kind: 'canal-desconocido', entityType: 'Reservation', entityId: r.id, note: `No hay canal WhatsApp autorizado para avisar la reserva ${r.id}. Avisar manualmente.` })
    } else {
      createTask(s, ctx, { businessId: r.businessId, kind: 'sin-consentimiento', entityType: 'Reservation', entityId: r.id, note: `${r.alias} no tiene consentimiento de servicio: no se envió la confirmación.` })
    }
    return
  }
  deliver(s, ctx, rule, run, tgt.conv!, {
    text: confirmationText(s, r, updated),
    link: { label: 'Ver mi reserva', to: `/${r.businessId}/reservas/${r.id}` },
  })
}

// ---------------------------------------------------------------- AU03 (reloj)
function supersedeRuns(s: AppState, ctx: Ctx, res: Reservation) {
  for (const run of s.runs) {
    if (run.entityType !== 'Reservation' || run.entityId !== res.id) continue
    if (run.entityVersion === res.version || run.entityVersion === 0) continue
    if (['pendiente', 'fallida'].includes(run.status)) {
      run.status = 'suprimida'
      run.detail = `Reemplazada por la versión ${res.version} de la reserva: no se envía.`
      log(run, ctx, run.detail)
      const m = byId(s.messages, run.messageId)
      if (m && m.status === 'fallido') m.status = 'pendiente'
    }
  }
}

function evaluateReminders(s: AppState, ctx: Ctx) {
  for (const r of s.reservations) {
    if (r.status !== 'confirmada') continue
    const rule = ruleOf(s, r.businessId, 'AU03')
    if (!rule) continue
    const start = reservationStartMs(r)
    const lead = ((rule.config.leadHours as number) ?? 2) * HOUR
    if (ctx.now < start - lead || ctx.now >= start) continue
    const st = startRun(s, ctx, rule, 'Reservation', r.id, r.version, 'T-2h')
    if (!st?.created) continue
    const { run } = st
    const tgt = whatsappTarget(s, r)
    if (!('conv' in tgt)) {
      run.status = tgt.reason === 'sin-consentimiento' ? 'omitida' : 'derivada'
      run.detail = tgt.reason === 'sin-consentimiento' ? 'Baja o sin consentimiento de servicio: recordatorio suprimido.' : 'Sin canal autorizado: se deriva a recepción.'
      log(run, ctx, run.detail)
      continue
    }
    deliver(s, ctx, rule, run, tgt.conv!, {
      text: `Recordatorio: ${r.id} · ${r.party} personas hoy a las ${hhmm(r.startMin)}. ¿Seguís viniendo?`,
      actions: [
        { id: `att-${r.id}`, label: 'Confirmar asistencia', payload: `attend:${r.id}` },
        { id: `cx-${r.id}`, label: 'Cancelar reserva', payload: `cancel:${r.id}` },
      ],
      link: { label: 'Ver mi reserva', to: `/${r.businessId}/reservas/${r.id}` },
    })
  }
}

// ---------------------------------------------------------------- AU04 (lista de espera)
function offerFromWaitlist(s: AppState, ctx: Ctx, businessId: BusinessId, hintTable?: string | null) {
  const rule = ruleOf(s, businessId, 'AU04')
  if (!rule) return
  const cands = s.waitlist.filter((w) => w.businessId === businessId && w.status === 'esperando').sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
  for (const w of cands) {
    const table = findFreeTable(s, { businessId, locationId: w.locationId, dateKey: w.dateKey, startMin: w.startMin, party: w.party })
    if (!table) continue
    const st = startRun(s, ctx, rule, 'WaitlistEntry', w.id, w.version, 'offer')
    if (!st?.created) continue
    w.status = 'ofrecida'
    w.offerStartMin = w.startMin
    w.offerExpiresAt = ctx.now + ((rule.config.ttlMin as number) ?? OFFER_TTL_MIN) * MINUTE
    w.version++
    st.run.status = 'ejecutada'
    st.run.attempts = 1
    st.run.detail = `Oferta registrada para ${w.alias} (${hhmm(w.startMin)}); vence en ${(rule.config.ttlMin as number) ?? OFFER_TTL_MIN} min simulados. El equipo debe validarla.`
    log(st.run, ctx, st.run.detail)
    audit(s, ctx, businessId, 'waitlist.offered', 'WaitlistEntry', w.id, st.run.detail)
    return
  }
  void hintTable
}

function withdrawStaleOffers(s: AppState, ctx: Ctx, businessId: BusinessId) {
  for (const w of s.waitlist) {
    if (w.businessId !== businessId || w.status !== 'ofrecida' || w.offerStartMin === null) continue
    const t = findFreeTable(s, { businessId, locationId: w.locationId, dateKey: w.dateKey, startMin: w.offerStartMin, party: w.party })
    if (!t) {
      w.status = 'retirada'
      w.version++
      audit(s, ctx, businessId, 'waitlist.offerWithdrawn', 'WaitlistEntry', w.id, `Oferta ${w.id} retirada: otra reserva ocupó el cupo`)
    }
  }
}

function expireOffers(s: AppState, ctx: Ctx) {
  for (const w of s.waitlist) {
    if (w.status === 'ofrecida' && w.offerExpiresAt !== null && ctx.now > w.offerExpiresAt) {
      w.status = 'vencida'
      w.version++
      audit(s, ctx, w.businessId, 'waitlist.offerExpired', 'WaitlistEntry', w.id, `Oferta ${w.id} vencida por reloj: no se confirma sola`)
      offerFromWaitlist(s, ctx, w.businessId)
    }
  }
  for (const b of s.eventBookings) {
    if (b.status === 'oferta' && b.offerExpiresAt !== null && ctx.now > b.offerExpiresAt) {
      b.status = 'vencida'
      b.version++
      audit(s, ctx, b.businessId, 'event.offerExpired', 'EventBooking', b.id, `Oferta de cata ${b.id} vencida`)
      offerNextEvent(s, ctx, b.businessId, b.eventId, b.id)
    }
  }
}

// ---------------------------------------------------------------- AU05
function au05(s: AppState, ctx: Ctx, o: Order) {
  const rule = ruleOf(s, o.businessId, 'AU05')
  if (!rule) return
  const st = startRun(s, ctx, rule, 'Order', o.id, 0, 'listo')
  if (!st?.created) return
  const { run } = st
  o.noticeRunId = run.id
  const tgt = whatsappTarget(s, { businessId: o.businessId, customerId: o.customerId, conversationId: o.conversationId })
  if (!('conv' in tgt)) {
    run.status = 'ejecutada'
    run.attempts = 1
    run.detail = `Sin canal de aviso: se muestra el código ${o.pickupCode} en pantalla.`
    log(run, ctx, run.detail)
    return
  }
  deliver(s, ctx, rule, run, tgt.conv!, {
    text: `Tu pedido ${o.id} está listo. Retiralo con el código ${o.pickupCode}.`,
    link: { label: 'Ver mi pedido', to: `/${o.businessId}/pedido/${o.id}` },
  })
}

// ---------------------------------------------------------------- AU06
function au06(s: AppState, ctx: Ctx, ev: DomainEvent) {
  const ing = byId(s.ingredients, ev.entityId)
  const rule = ruleOf(s, ev.businessId, 'AU06')
  if (!ing || !rule) return
  const state = ev.type === 'stock.out' ? 'agotado' : 'bajo'
  const st = startRun(s, ctx, rule, 'Ingredient', ing.id, 0, `${state}#${ing.epoch}`)
  if (!st?.created) return
  const affected = s.recipes.filter((r) => r.lines.some((l) => l.ingredientId === ing.id)).map((r) => byId(s.menuItems, r.itemId)?.name).filter(Boolean)
  st.run.status = 'ejecutada'
  st.run.attempts = 1
  st.run.detail = `${ing.name}: ${state}.${state === 'agotado' && affected.length ? ` Ítems pausados por falta de insumo: ${affected.join(', ')}.` : ''}`
  log(st.run, ctx, st.run.detail)
  createTask(s, ctx, { businessId: ing.businessId, kind: 'stock', entityType: 'Ingredient', entityId: ing.id, note: st.run.detail + ' Reponer o revisar.' })
}
function au06Invalid(s: AppState, ctx: Ctx, ev: DomainEvent) {
  const rule = ruleOf(s, ev.businessId, 'AU06')
  if (!rule) return
  const st = startRun(s, ctx, rule, 'Order', ev.entityId, 0, 'receta-unidad')
  if (!st?.created) return
  st.run.status = 'derivada'
  st.run.attempts = 1
  st.run.detail = 'Receta con unidad incompatible: se abrió una incidencia para el encargado.'
  log(st.run, ctx, st.run.detail)
}

// ---------------------------------------------------------------- AU07
function au07(s: AppState, ctx: Ctx, ev: DomainEvent) {
  const rule = ruleOf(s, ev.businessId, 'AU07')
  if (!rule) return
  const st = startRun(s, ctx, rule, ev.entityType, ev.entityId, 0, String(ev.payload?.reason ?? 'revision'))
  if (!st?.created) return
  st.run.status = 'derivada'
  st.run.attempts = 1
  st.run.detail = `Tarea humana creada (${ev.payload?.reason ?? 'revisión'}). No se garantiza seguridad alimentaria ni se interpreta diagnóstico.`
  log(st.run, ctx, st.run.detail)
}

// ---------------------------------------------------------------- AU08
function au08(s: AppState, ctx: Ctx, ev: DomainEvent) {
  const v = byId(s.visits, ev.entityId)
  const rule = ruleOf(s, ev.businessId, 'AU08')
  if (!v || !rule) return
  const st = startRun(s, ctx, rule, 'Visit', v.id, 0, 'credited')
  if (!st?.created) return
  const n = new Set(s.visits.filter((x) => x.customerId === v.customerId && x.status === 'acreditada').map((x) => x.dateKey)).size
  st.run.status = 'ejecutada'
  st.run.attempts = 1
  st.run.detail = `Sello único registrado. Total: ${n}.${n >= 5 ? ' Insignia de fidelización alcanzada (sin premio real).' : ''}`
  log(st.run, ctx, st.run.detail)
}

// ---------------------------------------------------------------- AU09
function offerNextEvent(s: AppState, ctx: Ctx, businessId: BusinessId, eventId: string, cause: string) {
  const rule = ruleOf(s, businessId, 'AU09')
  const e = byId(s.tastingEvents, eventId)
  if (!rule || !e) return
  const st = startRun(s, ctx, rule, 'EventBooking', cause, 0, 'freed')
  if (!st?.created) return
  const next = s.eventBookings.filter((b) => b.eventId === eventId && b.status === 'espera').sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))[0]
  st.run.attempts = 1
  if (!next || eventSeats(s, e).free <= 0) {
    st.run.status = 'ejecutada'
    st.run.detail = 'Lugar liberado; no hay lista de espera.'
    log(st.run, ctx, st.run.detail)
    return
  }
  next.status = 'oferta'
  next.offerExpiresAt = ctx.now + ((rule.config.ttlMin as number) ?? EVENT_OFFER_TTL_MIN) * MINUTE
  next.version++
  st.run.status = 'ejecutada'
  st.run.detail = `Lugar ofrecido a ${next.alias}; no se confirma hasta que acepte.`
  log(st.run, ctx, st.run.detail)
  audit(s, ctx, businessId, 'event.offered', 'EventBooking', next.id, st.run.detail)
}

// ---------------------------------------------------------------- dispatcher
export function processEvents(s: AppState, ctx: Ctx) {
  let guard = 0
  while (ctx.events.length && guard++ < 500) {
    const ev = ctx.events.shift()!
    switch (ev.type) {
      case 'reservation.requested':
        au01(s, ctx, ev)
        break
      case 'reservation.confirmed': {
        const r = byId(s.reservations, ev.entityId)
        if (r) {
          au02(s, ctx, r, false)
          withdrawStaleOffers(s, ctx, r.businessId)
          evaluateReminders(s, ctx)
        }
        break
      }
      case 'reservation.rescheduled': {
        const r = byId(s.reservations, ev.entityId)
        if (r) {
          supersedeRuns(s, ctx, r)
          if (r.status === 'confirmada') {
            au02(s, ctx, r, true)
            evaluateReminders(s, ctx)
          }
          withdrawStaleOffers(s, ctx, r.businessId)
          offerFromWaitlist(s, ctx, r.businessId)
        }
        break
      }
      case 'reservation.cancelled': {
        const r = byId(s.reservations, ev.entityId)
        if (r) {
          supersedeRuns(s, ctx, { ...r, version: r.version + 1 })
          offerFromWaitlist(s, ctx, r.businessId, (ev.payload?.freedTableId as string) ?? null)
        }
        break
      }
      case 'order.listo': {
        const o = byId(s.orders, ev.entityId)
        if (o) au05(s, ctx, o)
        break
      }
      case 'stock.low':
      case 'stock.out':
        au06(s, ctx, ev)
        break
      case 'stock.recipeInvalid':
        au06Invalid(s, ctx, ev)
        break
      case 'chat.humanReview':
        au07(s, ctx, ev)
        break
      case 'visit.credited':
        au08(s, ctx, ev)
        break
      case 'event.cancelled':
        offerNextEvent(s, ctx, ev.businessId, String(ev.payload?.eventId), ev.entityId)
        break
      case 'clock.advanced':
        expireOffers(s, ctx)
        evaluateReminders(s, ctx)
        for (const m of s.messages) {
          if (m.status === 'enviado' && m.sentAt !== null && ctx.now - m.sentAt >= MINUTE) m.status = 'entregado'
        }
        break
      default:
        break
    }
  }
}

// ---------------------------------------------------------------- comandos
const ruleToggle: Handler = (s, c, ctx) => {
  const r = byId(s.rules, c.ruleId)
  if (!r) return fail('regla-inexistente', 'Regla inexistente.')
  if (r.enabled === !!c.enabled) return dup()
  r.enabled = !!c.enabled
  audit(s, ctx, r.businessId, 'rule.toggled', 'AutomationRule', r.id, `${r.code} ${r.enabled ? 'activada' : 'pausada'}`)
  return ok()
}
const ruleFailNext: Handler = (s, c, ctx) => {
  const r = byId(s.rules, c.ruleId)
  if (!r) return fail('regla-inexistente', 'Regla inexistente.')
  r.failNext = !!c.value
  audit(s, ctx, r.businessId, 'rule.failNext', 'AutomationRule', r.id, `${r.code}: fallo inyectado ${r.failNext ? 'armado' : 'desarmado'} para la próxima entrega`)
  return ok()
}
const ruleConfig: Handler = (s, c, ctx) => {
  const r = byId(s.rules, c.ruleId)
  if (!r) return fail('regla-inexistente', 'Regla inexistente.')
  const lead = c.patch?.leadHours
  if (lead !== undefined && (!Number.isInteger(lead) || lead < 1 || lead > 24)) return fail('validacion', 'Las horas previas deben ser un entero entre 1 y 24.')
  r.config = { ...r.config, ...c.patch }
  r.version++ // nueva versión de regla ⇒ nuevas claves de ejecución
  audit(s, ctx, r.businessId, 'rule.configured', 'AutomationRule', r.id, `${r.code} actualizada a v${r.version}`)
  return ok()
}

const runRetry: Handler = (s, c, ctx) => {
  const run = byId(s.runs, c.runId)
  if (!run) return fail('ejecucion-inexistente', 'Ejecución inexistente.')
  if (['ejecutada', 'recuperada'].includes(run.status)) return dup({}, 'Esta ejecución ya se completó: no se reenvía.')
  if (!['fallida', 'pendiente'].includes(run.status)) return fail('estado-invalido', `Una ejecución “${run.status}” no se reintenta.`)
  const rule = byId(s.rules, run.ruleId)!
  const m = byId(s.messages, run.messageId)
  if (!m) {
    run.attempts++
    run.status = 'ejecutada'
    run.detail = 'Reintento completado (sin mensaje asociado).'
    log(run, ctx, run.detail)
    return ok()
  }
  const conv = byId(s.conversations, m.conversationId)!
  const wasFailed = run.status === 'fallida'
  run.attempts++
  const failing = rule.failNext
  if (failing) rule.failNext = false
  if (failing) {
    run.status = 'fallida'
    run.detail = 'El reintento también falló (fallo inyectado).'
    m.status = 'fallido'
    log(run, ctx, run.detail)
    return ok({ stillFailing: true })
  }
  m.status = 'enviado'
  m.sentAt = ctx.now
  conv.version++
  run.status = wasFailed ? 'recuperada' : 'ejecutada'
  run.detail = 'Reintento exitoso sobre la misma ejecución: un solo mensaje.'
  log(run, ctx, `Reintento #${run.attempts - 1}: enviado`)
  audit(s, ctx, run.businessId, 'run.retried', 'AutomationRun', run.id, `${run.id} reintentada y ${run.status}`)
  return ok()
}

const campaignPreview: Handler = (s, c, ctx) => {
  const rule = ruleOf(s, c.businessId, 'AU10')
  if (!rule) return fail('regla-inexistente', 'Regla inexistente.')
  if (!rule.enabled) return fail('regla-pausada', 'La regla de promoción está pausada.')
  const customers = s.customers.filter((x) => x.businessId === c.businessId && !x.mergedInto)
  const inc = customers.filter((x) => x.consent.promo)
  const exc = customers.filter((x) => !x.consent.promo)
  const n = s.campaignPreviews.filter((p) => p.businessId === c.businessId).length + 1
  const id = `CMP-${String(n).padStart(3, '0')}`
  s.campaignPreviews.push({ id, businessId: c.businessId, at: ctx.now, included: inc.length, excluded: exc.length })
  for (const x of exc) audit(s, ctx, c.businessId, 'campaign.skipped', 'CustomerDemo', x.id, `Omitido en vista previa ${id}: ${x.alias} no dio consentimiento promocional (el de servicio es aparte)`)
  const st = startRun(s, ctx, rule, 'Campaign', id, 0, 'preview')
  if (st?.created) {
    st.run.status = 'ejecutada'
    st.run.attempts = 1
    st.run.detail = `Vista previa: ${inc.length} destinatarios con consentimiento, ${exc.length} omitidos. No se envió ningún mensaje.`
    log(st.run, ctx, st.run.detail)
  }
  audit(s, ctx, c.businessId, 'campaign.preview', 'Campaign', id, `Vista previa ${id}: ${inc.length} incluidos, ${exc.length} omitidos`)
  return ok({ id, included: inc.map((x) => x.alias), excluded: exc.map((x) => x.alias) })
}

export const automationHandlers: Record<string, Handler> = {
  'rule/toggle': ruleToggle,
  'rule/failNext': ruleFailNext,
  'rule/config': ruleConfig,
  'run/retry': runRetry,
  'campaign/preview': campaignPreview,
}

export function previewRuleText(s: AppState, rule: AutomationRule): string {
  switch (rule.code) {
    case 'AU01':
      return 'Al confirmar el resumen con cupo se crea una solicitud (Solicitada) y una ejecución enlazada al hilo. Doble clic: un solo folio.'
    case 'AU02': {
      const n = s.reservations.filter((r) => r.businessId === rule.businessId && r.status === 'confirmada').length
      return `Hoy hay ${n} reserva(s) confirmada(s). Cada aceptación (por versión) encola UNA confirmación simulada si hay canal y consentimiento.`
    }
    case 'AU03': {
      const due = s.reservations.filter((r) => r.businessId === rule.businessId && r.status === 'confirmada' && s.clock.nowMs >= reservationStartMs(r) - REMINDER_LEAD_MS && s.clock.nowMs < reservationStartMs(r)).length
      return `Al cruzar T−${rule.config.leadHours ?? 2} h se encola un recordatorio con Confirmar/Cancelar. Ahora vencen ${due} recordatorio(s) en este reloj.`
    }
    case 'AU04':
      return `Si una cancelación libera cupo compatible, se ofrece al primer candidato (${s.waitlist.filter((w) => w.businessId === rule.businessId && w.status === 'esperando').length} esperando). La oferta vence a los ${rule.config.ttlMin} min simulados.`
    case 'AU05':
      return 'Cuando cocina/barra marca “Listo” se encola un aviso; sin canal se muestra el código en pantalla.'
    case 'AU06':
      return 'Al llegar al umbral o agotarse un insumo se crea una alerta y una tarea; los platos que dependen de él quedan pausados por falta de insumo.'
    case 'AU07':
      return 'Una preferencia alimentaria o un mensaje fuera de alcance crea una tarea humana y bloquea la aceptación automática.'
    case 'AU08':
      return 'Cada visita de muestra acreditada suma un sello único por persona y fecha; la insignia llega a la quinta. Sin premio real.'
    case 'AU09':
      return 'Si se cancela una inscripción con lista de espera, el lugar se ofrece al siguiente; no se confirma sin aceptación.'
    case 'AU10':
      return 'Solo vista previa. Se omiten los clientes sin consentimiento promocional y se registra la omisión. No sale ningún mensaje.'
    default:
      return ''
  }
}

export type { Outcome }
