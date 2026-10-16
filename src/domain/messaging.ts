import { base, nextId, type Ctx } from './core'
import type { AppState, ChatAction, Channel, Conversation, Message } from './types'

export function addMessage(
  s: AppState,
  ctx: Ctx,
  conv: Conversation,
  p: {
    from: Message['from']
    text: string
    channel?: Channel
    status?: Message['status']
    actions?: ChatAction[]
    link?: Message['link']
    messageKey?: string | null
  },
): Message {
  if (p.messageKey) {
    const ex = s.messages.find((m) => m.conversationId === conv.id && m.messageKey === p.messageKey)
    if (ex) return ex
  }
  const status = p.status ?? (p.from === 'cliente' ? 'entregado' : 'enviado')
  const m: Message = {
    id: nextId(s, 'MSG', 4),
    ...base(s, conv.businessId),
    conversationId: conv.id,
    from: p.from,
    text: p.text,
    channel: p.channel ?? conv.channel,
    status,
    actions: p.actions ?? [],
    link: p.link ?? null,
    messageKey: p.messageKey ?? null,
    sentAt: status === 'enviado' || status === 'entregado' ? ctx.now : null,
  }
  s.messages.push(m)
  conv.version++
  return m
}

export function conversationOfCustomer(s: AppState, businessId: string, customerId: string | null): Conversation | undefined {
  if (!customerId) return undefined
  return s.conversations.find((c) => c.businessId === businessId && c.customerId === customerId)
}
