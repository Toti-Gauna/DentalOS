import type { AppState, AuditEvent, BusinessId, Role } from './types'

export type Outcome<T = unknown> =
  | { ok: true; data?: T; duplicate?: boolean; message?: string }
  | { ok: false; code: string; message: string; data?: unknown; commit?: boolean }

export const ok = <T>(data?: T, message?: string): Outcome<T> => ({ ok: true, data, message })
export const dup = <T>(data?: T, message?: string): Outcome<T> => ({ ok: true, data, duplicate: true, message })
export const fail = (code: string, message: string, data?: unknown): Outcome<never> => ({ ok: false, code, message, data })

export interface DomainEvent {
  type: string
  businessId: BusinessId
  entityType: string
  entityId: string
  payload?: Record<string, unknown>
}

export interface Ctx {
  now: number
  actor: Role | 'sistema'
  correlationId: string
  events: DomainEvent[]
}

/** IDs deterministas: contador persistente por prefijo (nunca Date.now ni Math.random). */
export function nextNum(s: AppState, prefix: string): number {
  const n = (s.counters[prefix] ?? 0) + 1
  s.counters[prefix] = n
  return n
}
export function nextId(s: AppState, prefix: string, width = 3): string {
  return `${prefix}-${String(nextNum(s, prefix)).padStart(width, '0')}`
}

export function base(s: AppState, businessId: BusinessId) {
  return { businessId, createdAt: s.clock.nowMs, version: 1 }
}

export function audit(
  s: AppState,
  ctx: Ctx,
  businessId: BusinessId,
  type: string,
  entityType: string,
  entityId: string,
  summary: string,
  operationId: string | null = null,
  correlationId?: string,
): AuditEvent {
  const ev: AuditEvent = {
    id: nextId(s, 'AUD', 4),
    businessId,
    createdAt: ctx.now,
    version: 1,
    at: ctx.now,
    actor: ctx.actor,
    type,
    entityType,
    entityId,
    correlationId: correlationId ?? ctx.correlationId,
    operationId,
    summary,
  }
  s.audit.push(ev)
  return ev
}

export function emit(ctx: Ctx, ev: DomainEvent) {
  ctx.events.push(ev)
}

/** Normaliza para NLU y búsqueda: minúsculas, sin acentos, espacios colapsados. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[¿?¡!.,;()"]/g, ' ')
    .replace(/(?<!\d):|:(?!\d)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
export const byId = <T extends { id: string }>(arr: T[], id: string | null | undefined): T | undefined =>
  id ? arr.find((x) => x.id === id) : undefined
