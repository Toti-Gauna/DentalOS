import { audit, byId, dup, emit, fail, nextId, ok } from './core'
import { ensureCustomer } from './customers'
import { atLocal, dateKeyOf, minutesOfDay, MINUTE } from './time'
import type { AppState, BusinessId, Role } from './types'
import type { Handler } from './cmd-commerce'

const ROLES: Role[] = ['cliente-invitado', 'cliente-recurrente', 'recepcion', 'mozo', 'cocina', 'caja', 'encargado']

const clockAdvance: Handler = (s, c, ctx) => {
  const min = c.minutes
  if (!Number.isInteger(min) || min <= 0 || min > 7 * 24 * 60) return fail('reloj-invalido', 'Avanzá entre 1 minuto y 7 días. El reloj de la demo no retrocede.')
  s.clock.nowMs += min * MINUTE
  ctx.now = s.clock.nowMs
  audit(s, ctx, s.session.businessId, 'clock.advanced', 'Clock', 'clock', `Reloj simulado +${min} min`)
  emit(ctx, { type: 'clock.advanced', businessId: s.session.businessId, entityType: 'Clock', entityId: 'clock' })
  return ok({ nowMs: s.clock.nowMs })
}

/** Salta a una hora del día (hoy o el día simulado siguiente si ya pasó). */
const clockJump: Handler = (s, c, ctx) => {
  const targetMin: number = c.minutes
  if (!Number.isInteger(targetMin) || targetMin < 0 || targetMin >= 24 * 60) return fail('reloj-invalido', 'Hora inválida.')
  let key = dateKeyOf(s.clock.nowMs)
  let target = atLocal(key, targetMin)
  if (c.nextDay || target <= s.clock.nowMs) {
    const [y, m, dd] = key.split('-').map(Number)
    const nd = new Date(Date.UTC(y, m - 1, dd + 1))
    key = `${nd.getUTCFullYear()}-${String(nd.getUTCMonth() + 1).padStart(2, '0')}-${String(nd.getUTCDate()).padStart(2, '0')}`
    target = atLocal(key, targetMin)
  }
  const diff = Math.round((target - s.clock.nowMs) / MINUTE)
  if (diff <= 0) return dup()
  return clockAdvance(s, { minutes: diff }, ctx)
}

const setRole: Handler = (s, c, ctx) => {
  if (!ROLES.includes(c.role)) return fail('rol-invalido', 'Rol inválido.')
  s.session.role = c.role
  if (c.role === 'cliente-invitado') {
    s.session.customerByBusiness = { 'mesa-clara': null, 'ritual-cafe': null }
  } else if (c.role === 'cliente-recurrente') {
    for (const b of ['mesa-clara', 'ritual-cafe'] as BusinessId[]) {
      const existing = s.customers.find((x) => x.businessId === b && x.alias === 'Ana' && !x.mergedInto)
      s.session.customerByBusiness[b] = (existing ?? ensureCustomer(s, ctx, b, 'Ana', { whatsapp: true, voz: true })).id
    }
  }
  return ok()
}
const setBusiness: Handler = (s, c) => {
  if (!byId(s.businesses, c.businessId)) return fail('negocio-inexistente', 'Negocio inexistente.')
  s.session.businessId = c.businessId
  return ok()
}
const setLocation: Handler = (s, c) => {
  const loc = byId(s.locations, c.locationId)
  if (!loc) return fail('sede-inexistente', 'Sede inexistente.')
  s.session.locationByBusiness[loc.businessId] = loc.id
  return ok()
}

const configSet: Handler = (s, c, ctx) => {
  const b = byId(s.businesses, c.businessId)
  if (!b) return fail('negocio-inexistente', 'Negocio inexistente.')
  const p = c.patch ?? {}
  const errors: Record<string, string> = {}
  if ('serviceMinutes' in p && (!Number.isInteger(p.serviceMinutes) || p.serviceMinutes < 30 || p.serviceMinutes > 240)) errors.serviceMinutes = 'La duración debe estar entre 30 y 240 minutos.'
  if ('bufferMinutes' in p && (!Number.isInteger(p.bufferMinutes) || p.bufferMinutes < 0 || p.bufferMinutes > 60)) errors.bufferMinutes = 'El margen debe estar entre 0 y 60 minutos.'
  if ('maxPartyAuto' in p && (!Number.isInteger(p.maxPartyAuto) || p.maxPartyAuto < 1 || p.maxPartyAuto > 40)) errors.maxPartyAuto = 'El máximo automático debe estar entre 1 y 40.'
  if ('pickupPerSlot' in p && (!Number.isInteger(p.pickupPerSlot) || p.pickupPerSlot < 1 || p.pickupPerSlot > 30)) errors.pickupPerSlot = 'Los retiros por franja deben estar entre 1 y 30.'
  if (Object.keys(errors).length) return fail('validacion', 'Hay valores para corregir.', { errors })
  const allowed = ['reservationsEnabled', 'autoConfirmReservations', 'serviceMinutes', 'bufferMinutes', 'maxPartyAuto', 'pickupPerSlot']
  const changed: string[] = []
  for (const k of Object.keys(p)) {
    if (!allowed.includes(k)) continue
    if ((b as any)[k] !== p[k]) {
      ;(b as any)[k] = p[k]
      changed.push(`${k}=${p[k]}`)
    }
  }
  if (!changed.length) return dup()
  b.version++
  audit(s, ctx, b.id, 'config.updated', 'BusinessProfile', b.id, `Configuración: ${changed.join(', ')}`)
  return ok()
}

const windowSet: Handler = (s, c, ctx) => {
  const w = byId(s.serviceWindows, c.windowId)
  if (!w) return fail('franja-inexistente', 'Franja inexistente.')
  if (!(Number.isInteger(c.startMin) && Number.isInteger(c.endMin) && c.startMin >= 0 && c.endMin <= 24 * 60 && c.startMin < c.endMin)) return fail('validacion', 'La franja debe tener inicio anterior al fin dentro del día.')
  w.startMin = c.startMin
  w.endMin = c.endMin
  w.version++
  audit(s, ctx, w.businessId, 'config.window', 'ServiceWindow', w.id, `Franja ${w.label}: ${Math.floor(c.startMin / 60)}:${String(c.startMin % 60).padStart(2, '0')}–${Math.floor(c.endMin / 60)}:${String(c.endMin % 60).padStart(2, '0')}`)
  return ok()
}

/** Reserva un identificador de operación (contador persistente): el formulario lo reutiliza ante reintentos. */
const opAlloc: Handler = (s) => ok({ operationId: nextId(s, 'OP', 4) })

export const systemHandlers: Record<string, Handler> = {
  'op/alloc': opAlloc,
  'clock/advance': clockAdvance,
  'clock/jump': clockJump,
  'session/setRole': setRole,
  'session/setBusiness': setBusiness,
  'session/setLocation': setLocation,
  'config/set': configSet,
  'config/window': windowSet,
}
export { minutesOfDay }
