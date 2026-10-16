import { automationHandlers, processEvents } from './automations'
import { bookingHandlers } from './cmd-booking'
import { cashHandlers } from './cmd-cash'
import { commerceHandlers, type Handler } from './cmd-commerce'
import { engageHandlers } from './cmd-engage'
import { systemHandlers } from './cmd-system'
import { callHandlers } from './call'
import { chatHandlers } from './chat'
import { fail, nextId, type Ctx, type Outcome } from './core'
import type { AppState, Role } from './types'

export interface Command {
  type: string
  actor?: Role | 'sistema'
  correlationId?: string
  [k: string]: any
}

export const HANDLERS: Record<string, Handler> = {
  ...commerceHandlers,
  ...bookingHandlers,
  ...cashHandlers,
  ...engageHandlers,
  ...automationHandlers,
  ...chatHandlers,
  ...callHandlers,
  ...systemHandlers,
}

/**
 * Reducer transaccional: aplica el comando sobre una copia. Si falla (o es un duplicado idempotente)
 * se devuelve el estado original intacto: no hay cambios parciales.
 */
export function applyCommand(state: AppState, cmd: Command): { state: AppState; outcome: Outcome } {
  const handler = HANDLERS[cmd.type]
  if (!handler) return { state, outcome: fail('comando-desconocido', `Comando desconocido: ${cmd.type}`) }
  const draft = structuredClone(state)
  const ctx: Ctx = {
    now: draft.clock.nowMs,
    actor: cmd.actor ?? draft.session.role,
    correlationId: cmd.correlationId ?? '',
    events: [],
  }
  if (!ctx.correlationId) ctx.correlationId = nextId(draft, 'COR', 4)
  let outcome: Outcome
  try {
    outcome = handler(draft, cmd, ctx)
  } catch (e) {
    return { state, outcome: fail('error-interno', `Error interno: ${(e as Error).message}`) }
  }
  if (!outcome.ok) {
    if (!outcome.commit) return { state, outcome }
  } else if (outcome.duplicate) {
    return { state, outcome }
  }
  processEvents(draft, ctx)
  return { state: draft, outcome }
}
