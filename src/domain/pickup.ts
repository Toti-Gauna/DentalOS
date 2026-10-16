import { fail, ok, type Outcome } from './core'
import { windowsFor } from './availability'
import { dateKeyOf, hhmm, minutesOfDay } from './time'
import type { AppState } from './types'

const LEAD_MIN = 10 // anticipación mínima del retiro, en minutos del reloj simulado

export function pickupCount(s: AppState, locationId: string, dateKey: string, startMin: number): number {
  return s.orders.filter(
    (o) => o.kind === 'retiro' && o.locationId === locationId && o.pickup?.dateKey === dateKey && o.pickup.startMin === startMin && !['cancelado', 'rechazado'].includes(o.status),
  ).length
}

/** Franjas de retiro válidas (cada 15 min, dentro de horario, sin pasado, con cupo). */
export function pickupSlots(s: AppState, businessId: string, locationId: string, max = 48): number[] {
  const dk = dateKeyOf(s.clock.nowMs)
  const nowMin = minutesOfDay(s.clock.nowMs)
  const cap = s.businesses.find((b) => b.id === businessId)?.pickupPerSlot ?? 6
  const out: number[] = []
  for (const w of windowsFor(s, locationId, dk)) {
    for (let m = w.startMin; m + 15 <= w.endMin; m += 15) {
      if (m < nowMin + LEAD_MIN) continue
      if (pickupCount(s, locationId, dk, m) >= cap) continue
      out.push(m)
      if (out.length >= max) return out
    }
  }
  return out
}

export function alternativesPickup(s: AppState, businessId: string, locationId: string, n = 3): number[] {
  return pickupSlots(s, businessId, locationId, n)
}

export function validatePickup(s: AppState, businessId: string, locationId: string, startMin: number | null): Outcome {
  const loc = s.locations.find((l) => l.id === locationId)
  if (!loc?.pickupEnabled) return fail('retiro-no-disponible', 'Esta sede no ofrece retiro por franja.')
  const alts = alternativesPickup(s, businessId, locationId, 3)
  const altText = alts.length ? ` Próximas franjas válidas: ${alts.map(hhmm).join(', ')}.` : ' No quedan franjas hoy en el día simulado.'
  if (startMin === null || !Number.isInteger(startMin)) return fail('franja-requerida', `Elegí un horario de retiro.${altText}`, { alternatives: alts })
  const dk = dateKeyOf(s.clock.nowMs)
  if (startMin % 15 !== 0) return fail('franja-invalida', `Los retiros se coordinan en franjas de 15 minutos.${altText}`, { alternatives: alts })
  const inWindow = windowsFor(s, locationId, dk).some((w) => startMin >= w.startMin && startMin + 15 <= w.endMin)
  if (!inWindow) return fail('fuera-de-horario', `Fuera de horario: ${hhmm(startMin)} no es una franja de atención.${altText}`, { alternatives: alts })
  if (startMin < minutesOfDay(s.clock.nowMs) + LEAD_MIN) return fail('franja-pasada', `Esa franja ya pasó o es demasiado próxima en el día simulado.${altText}`, { alternatives: alts })
  const cap = s.businesses.find((b) => b.id === businessId)?.pickupPerSlot ?? 6
  if (pickupCount(s, locationId, dk, startMin) >= cap) return fail('retiro-lleno', `La franja ${hhmm(startMin)} está completa (${cap} retiros).${altText}`, { alternatives: alts })
  return ok()
}
