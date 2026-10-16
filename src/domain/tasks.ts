import { audit, base, nextId, type Ctx } from './core'
import type { AppState, BusinessId, HumanReviewTask } from './types'

export function createTask(
  s: AppState,
  ctx: Ctx,
  p: {
    businessId: BusinessId
    kind: HumanReviewTask['kind']
    entityType: string
    entityId: string
    note: string
    conversationId?: string | null
    draft?: Record<string, unknown> | null
  },
): HumanReviewTask {
  const open = s.tasks.find((t) => t.kind === p.kind && t.entityId === p.entityId && t.status === 'pendiente')
  if (open) return open
  const t: HumanReviewTask = {
    id: nextId(s, 'TASK'),
    ...base(s, p.businessId),
    kind: p.kind,
    status: 'pendiente',
    entityType: p.entityType,
    entityId: p.entityId,
    conversationId: p.conversationId ?? null,
    note: p.note,
    resolution: null,
    draft: p.draft ?? null,
    correlationId: ctx.correlationId,
  }
  s.tasks.push(t)
  audit(s, ctx, p.businessId, 'task.created', p.entityType, p.entityId, `Tarea de revisión humana (${p.kind}): ${p.note}`)
  return t
}
